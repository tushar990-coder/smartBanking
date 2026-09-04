import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { PlusCircle, Search, Edit, Trash2 } from 'lucide-react';

interface SecurityType {
    securityTypeID: number;
    name: string;
    isActive: boolean;
}

const SecurityTypeMaster: React.FC = () => {
    const [securityTypes, setSecurityTypes] = useState<SecurityType[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const formContainerRef = useRef<HTMLDivElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState<Partial<SecurityType>>({
        name: '',
        isActive: true
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/SecurityTypes');
            setSecurityTypes(res.data);
        } catch (err) {
            console.error(err);
            setError('Failed to fetch security types');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            if (editingId) {
                await axios.put(`/api/SecurityTypes/${editingId}`, { ...formData, securityTypeID: editingId });
            } else {
                await axios.post('/api/SecurityTypes', formData);
            }
            setFormData({ name: '', isActive: true });
            setEditingId(null);
            fetchData();
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data || 'An error occurred while saving.');
        }
    };

    const handleEdit = (st: SecurityType) => {
        setEditingId(st.securityTypeID);
        setFormData({
            name: st.name,
            isActive: st.isActive
        });

        if (formContainerRef.current) {
            formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        setTimeout(() => {
            if (nameInputRef.current) {
                nameInputRef.current.focus();
                nameInputRef.current.select();
            }
        }, 120);
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('Are you sure you want to delete this security type?')) {
            try {
                await axios.delete(`/api/SecurityTypes/${id}`);
                fetchData();
            } catch (err) {
                console.error(err);
                setError('Failed to delete security type.');
            }
        }
    };

    const filteredTypes = securityTypes.filter(st => 
        st.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-1 max-w-7xl mx-auto bg-gray-50 min-h-screen font-sans pb-4">
            <div className="mb-2 flex justify-between items-end border-b-2 border-red-600 pb-1">
                <h1 className="text-lg font-bold text-gray-800">Security Type Master (तारण प्रकार)</h1>
            </div>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-sm mb-3 text-xs">
                    {error}
                </div>
            )}

            <div 
                ref={formContainerRef}
                className={`bg-white p-2 rounded-sm shadow-sm border transition-all duration-300 mb-3 ${
                    editingId ? 'border-primary ring-2 ring-primary/20 shadow-md bg-blue-50/10' : 'border-gray-200'
                }`}
            >
                <div className="flex justify-between items-center border-b pb-1 mb-2">
                    <h2 className="text-sm font-bold text-primary flex items-center gap-2">
                        <span>{editingId ? `✏️ तारण प्रकार सुधारा (संपादन मोड - आयडी: ${editingId})` : '➕ नवीन तारण प्रकार (New Security Type)'}</span>
                        {editingId && (
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                                संपादन चालू (Editing)
                            </span>
                        )}
                    </h2>
                    {editingId && (
                        <button 
                            type="button" 
                            onClick={() => {
                                setFormData({ name: '', isActive: true });
                                setEditingId(null);
                            }}
                            className="text-xs text-gray-500 hover:text-red-600 font-semibold cursor-pointer"
                        >
                            ✕ संपादन रद्द करा (Cancel)
                        </button>
                    )}
                </div>
                <form onSubmit={handleSubmit} className="space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-gray-700 mb-0.5">तारण प्रकार (Security Type Name) *</label>
                            <input 
                                ref={nameInputRef}
                                type="text" 
                                name="name" 
                                value={formData.name} 
                                onChange={handleInputChange} 
                                required 
                                className={`w-full border px-2 py-1 rounded-sm focus:outline-none focus:border-blue-500 text-xs ${
                                    editingId ? 'border-primary bg-amber-50/40 font-semibold' : 'border-gray-300'
                                }`} 
                            />
                        </div>
                        <div className="flex items-end pb-1">
                            <label className="flex items-center text-xs font-semibold text-gray-700 cursor-pointer">
                                <input type="checkbox" name="isActive" checked={formData.isActive || false} onChange={handleInputChange} 
                                    className="mr-2" />
                                सक्रिय (Active)
                            </label>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                        {editingId && (
                            <button type="button" onClick={() => {
                                setFormData({ name: '', isActive: true });
                                setEditingId(null);
                            }} className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-1 rounded-sm font-medium text-xs">
                                रद्द करा (Cancel)
                            </button>
                        )}
                        <button type="submit" className="bg-primary hover:bg-[#004a75] text-white px-6 py-1 rounded-sm font-medium text-xs">
                            {editingId ? 'अपडेट करा (Update)' : 'सेव्ह करा (Save)'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-white p-2 rounded-sm shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                    <div className="relative w-1/3">
                        <input type="text" placeholder="शोधा..." className="w-full border border-gray-300 px-2 py-0.5 pl-6 rounded-sm text-xs focus:outline-none focus:border-blue-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        <Search className="w-3 h-3 text-gray-400 absolute left-1.5 top-1" />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-100 text-gray-700 text-xs uppercase tracking-wider">
                                <th className="p-1.5 border">तारण प्रकार (Name)</th>
                                <th className="p-1.5 border text-center">स्थिती (Status)</th>
                                <th className="p-1.5 border text-center w-20">कृती (Action)</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs text-gray-800">
                            {loading ? (
                                <tr><td colSpan={3} className="text-center p-2">Loading...</td></tr>
                            ) : filteredTypes.length === 0 ? (
                                <tr><td colSpan={3} className="text-center p-2 text-gray-500">माहिती उपलब्ध नाही.</td></tr>
                            ) : (
                                filteredTypes.map(st => (
                                    <tr key={st.securityTypeID} className="border-b hover:bg-gray-50">
                                        <td className="p-1.5 border font-medium">{st.name}</td>
                                        <td className="p-1.5 border text-center">
                                            <span className={`px-2 py-0.5 rounded-sm font-semibold ${st.isActive ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                                                {st.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="p-1.5 border text-center">
                                            <button onClick={() => handleEdit(st)} className="text-blue-600 hover:text-blue-900 mx-1" title="Edit">
                                                <Edit className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => handleDelete(st.securityTypeID)} className="text-red-600 hover:text-red-900 mx-1" title="Delete">
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
    );
};

export default SecurityTypeMaster;

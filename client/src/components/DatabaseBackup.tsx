import React, { useState } from 'react';

const DatabaseBackup: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);

    const handleBackup = async () => {
        setLoading(true);
        setMessage('');
        setIsError(false);
        try {
            // Extract token safely from local storage
            let token = localStorage.getItem('token');
            if (!token) {
                const savedUser = localStorage.getItem('bhisi_user');
                if (savedUser) {
                    try {
                        const parsed = JSON.parse(savedUser);
                        token = parsed.token;
                    } catch (e) {
                        console.error('Failed to parse bhisi_user', e);
                    }
                }
            }

            const res = await fetch('/api/Backup/generate', {
                method: 'POST',
                headers: { 
                    'Authorization': token ? `Bearer ${token}` : '' 
                }
            });
            
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                
                const disposition = res.headers.get('content-disposition');
                let filename = 'SmartBanking_Backup.bak';
                if (disposition && disposition.indexOf('attachment') !== -1) {
                    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                    const matches = filenameRegex.exec(disposition);
                    if (matches != null && matches[1]) { 
                        filename = matches[1].replace(/['"]/g, '');
                    }
                }
                
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                
                setIsError(false);
                setMessage("✅ डेटाबेस बॅकअप यशस्वीरित्या जनरेट व डाउनलोड झाला आहे!");
            } else {
                setIsError(true);
                const text = await res.text();
                let errorMsg = text;
                try {
                    const parsed = JSON.parse(text);
                    errorMsg = parsed.Message || parsed.message || parsed.error || text;
                } catch (e) {}
                setMessage("❌ बॅकअप त्रुटी: " + errorMsg);
            }
        } catch (error: any) {
            setIsError(true);
            setMessage("❌ नेटवर्क त्रुटी: " + (error?.message || "बॅकअप बनवताना समस्या आली. कृपया पुन्हा प्रयत्न करा."));
        }
        setLoading(false);
    };

    return (
        <div className="p-6 max-w-4xl">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span>💾</span> डेटाबेस बॅकअप (System Backup)
            </h2>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <p className="mb-4 text-slate-600 text-sm font-medium">
                    सध्याच्या पूर्ण डेटाबेसची `.bak` बॅकअप फाईल जनरेट करून डाऊनलोड करण्यासाठी खालील बटणावर क्लिक करा.
                </p>
                
                <button 
                    onClick={handleBackup} 
                    disabled={loading}
                    className={`px-5 py-2.5 text-white font-bold rounded-lg transition-all text-sm flex items-center gap-2 cursor-pointer shadow-sm ${
                        loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-primary hover:opacity-90 active:scale-95'
                    }`}
                >
                    {loading ? (
                        <>
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            <span>बॅकअप तयार होत आहे... (Generating...)</span>
                        </>
                    ) : (
                        <>
                            <span>💾</span>
                            <span>डेटाबेस बॅकअप डाऊनलोड करा (Generate & Download Backup)</span>
                        </>
                    )}
                </button>
                
                {message && (
                    <div className={`mt-4 p-3 rounded-lg text-sm font-semibold border ${
                        isError 
                            ? 'bg-rose-50 text-rose-700 border-rose-200' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                        {message}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DatabaseBackup;

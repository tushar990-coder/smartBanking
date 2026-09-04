import React, { useState, useEffect } from 'react';

const YearEndClosure: React.FC = () => {
    const [status, setStatus] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/YearEndOperations/status/1', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStatus(data);
            }
        } catch (error) {
            console.error("Failed to fetch year end status", error);
        }
    };

    const handleCloseYear = async () => {
        if (!window.confirm("Are you sure you want to close the financial year? This action cannot be undone.")) return;
        
        setLoading(true);
        setMessage('');
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/YearEndOperations/close/1', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const data = await res.json();
            if (res.ok) {
                setMessage("Success: " + data.message);
                fetchStatus();
            } else {
                setMessage("Error: " + data.message);
            }
        } catch (error) {
            setMessage("Network Error");
        }
        setLoading(false);
    };

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Financial Year Closure</h2>
            {status ? (
                <div className="bg-white p-4 rounded shadow mb-4">
                    <p><strong>Current Financial Year:</strong> {status.currentFinancialYear}</p>
                    <p><strong>Last Closed Date:</strong> {status.lastClosedDate ? new Date(status.lastClosedDate).toLocaleDateString() : 'N/A'}</p>
                    <p><strong>Ready for Closure:</strong> {status.isReadyForClosure ? "Yes" : "No"}</p>
                </div>
            ) : <p>Loading status...</p>}
            
            <button 
                onClick={handleCloseYear} 
                disabled={loading || (status && !status.isReadyForClosure)}
                className={`px-4 py-2 text-white rounded ${loading || (status && !status.isReadyForClosure) ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700'}`}
            >
                {loading ? 'Processing...' : 'Close Financial Year'}
            </button>
            
            {message && <p className="mt-4 font-semibold">{message}</p>}
        </div>
    );
};

export default YearEndClosure;

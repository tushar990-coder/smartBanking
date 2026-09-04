import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import Select from 'react-select';

interface FinancialYear {
  financialYearID: number;
  yearCode: string;
  startDate: string;
  endDate: string;
}

interface LegacyLedger {
  legacyId: number;
  name: string;
  groupName: string;
}

interface SystemLedger {
  ledgerID: number;
  ledgerName: string;
  legacyLedgerId: number | null;
  groupName: string;
}

export default function LegacyDataImportMaster() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadedFilePath, setUploadedFilePath] = useState('');
  
  const [activeStep, setActiveStep] = useState(0); // 0: Upload, 1: FinYears & Masters, 2: Ledgers, 3: Members & Accounts, 4: Done

  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [selectedFinancialYearId, setSelectedFinancialYearId] = useState<number>(0);

  const [legacyLedgers, setLegacyLedgers] = useState<LegacyLedger[]>([]);
  const [systemLedgers, setSystemLedgers] = useState<SystemLedger[]>([]);
  const [mappedLedgers, setMappedLedgers] = useState<{ [key: number]: number }>({});

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const uploadAndTestConnection = async () => {
    if (!file) {
      alert("Please select a legacy database file (.mdf or .bak).");
      return;
    }
    setLoading(true);
    setMessage('Uploading database and testing connection...');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch('/api/LegacyDataImport/upload-test', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (response.ok) {
        setUploadedFilePath(data.filePath);
        setMessage(`Success: ${data.message} Found ${data.customerCount} customers.`);
        setActiveStep(1);
      } else {
        setMessage(`Error: ${data.message}`);
      }
    } catch (error: any) {
      setMessage(`Network error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchFinancialYears = async () => {
    try {
      const res = await fetch('/api/FinancialYears');
      const data = await res.json();
      setFinancialYears(data);
    } catch (e) {
      console.error(e);
    }
  };

  const importFinancialYears = async () => {
    setLoading(true);
    setMessage('Importing Financial Years...');
    try {
      const response = await fetch('/api/LegacyDataImport/import-financial-years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: uploadedFilePath })
      });
      if (response.ok) {
        await fetchFinancialYears();
        setMessage('Financial Years imported successfully. Please select the target Financial Year below.');
      } else {
        const data = await response.json();
        setMessage(`Error: ${data.message}`);
      }
    } catch (error: any) {
      setMessage(`Network error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const importMasters = async () => {
    if (selectedFinancialYearId === 0) {
      alert("Please select a Financial Year first.");
      return;
    }
    setLoading(true);
    setMessage('Importing Masters (Employers & Account Groups)...');
    try {
      const response = await fetch('/api/LegacyDataImport/import-masters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: uploadedFilePath })
      });
      if (response.ok) {
        setActiveStep(2);
        setMessage('Masters imported successfully. Now moving to Ledger Mapping.');
        await previewLedgers();
      } else {
        const data = await response.json();
        setMessage(`Error: ${data.message}`);
      }
    } catch (error: any) {
      setMessage(`Network error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const previewLedgers = async () => {
    try {
      const response = await fetch('/api/LegacyDataImport/preview-ledgers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: uploadedFilePath })
      });
      const data = await response.json();
      if (response.ok) {
        setLegacyLedgers(data.legacyLedgers);
        setSystemLedgers(data.systemLedgers);
        
        // Auto-map based on explicit mapping first, then by name
        const autoMap: { [key: number]: number } = {};
        data.legacyLedgers.forEach((ll: LegacyLedger) => {
          let matched = data.systemLedgers.find((sl: SystemLedger) => sl.legacyLedgerId === ll.legacyId);
          if (!matched) {
            matched = data.systemLedgers.find((sl: SystemLedger) => sl.ledgerName === ll.name && !sl.legacyLedgerId);
          }
          if (matched) {
            autoMap[ll.legacyId] = matched.ledgerID;
          }
        });
        setMappedLedgers(autoMap);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleMapChange = (legacyId: number, systemId: number | null) => {
    if (!systemId) {
      const newMap = { ...mappedLedgers };
      delete newMap[legacyId];
      setMappedLedgers(newMap);
    } else {
      setMappedLedgers({ ...mappedLedgers, [legacyId]: systemId });
    }
  };

  const groupedLedgerOptions = useMemo(() => {
    const groups: { [key: string]: { value: number, label: string }[] } = {};
    systemLedgers.forEach(sl => {
      const gName = sl.groupName || 'Uncategorized';
      if (!groups[gName]) groups[gName] = [];
      groups[gName].push({ value: sl.ledgerID, label: sl.ledgerName });
    });
    return Object.keys(groups).sort().map(gName => ({
      label: gName,
      options: groups[gName].sort((a, b) => a.label.localeCompare(b.label))
    }));
  }, [systemLedgers]);

  const syncLedgers = async () => {
    setLoading(true);
    setMessage('Saving Ledger Mappings...');
    try {
      const response = await fetch('/api/LegacyDataImport/sync-ledgers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: uploadedFilePath, mappedLedgers })
      });
      if (response.ok) {
        setMessage('Ledger mappings saved successfully! You can map more or proceed to Step 3.');
      } else {
        const data = await response.json();
        setMessage(`Error: ${data.message}`);
      }
    } catch (error: any) {
      setMessage(`Network error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const importMembersAndAccounts = async () => {
    setLoading(true);
    setMessage('Importing Members and linking Personal Accounts...');
    try {
      const response = await fetch('/api/LegacyDataImport/import-members-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: uploadedFilePath, financialYearId: selectedFinancialYearId })
      });
      if (response.ok) {
        setActiveStep(4);
        setMessage('Phase 1 completed successfully! Members are imported.');
      } else {
        const data = await response.json();
        setMessage(`Error: ${data.message}`);
      }
    } catch (error: any) {
      setMessage(`Network error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const importFinancialData = async () => {
    if (!uploadedFilePath || selectedFinancialYearId === 0) return;
    setLoading(true);
    setMessage('Importing Opening Balances and Transactions (Vouchers)... Please wait.');
    try {
      const payload = {
        filePath: uploadedFilePath,
        financialYearId: selectedFinancialYearId
      };
      const response = await fetch('/api/LegacyDataImport/import-financial-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(data.message || 'Financial data imported successfully!');
        setActiveStep(5);
      } else {
        setMessage(`Error: ${data.message}`);
      }
    } catch (err: any) {
      setMessage('Error importing financial data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const clearExistingData = async () => {
    if (!window.confirm("WARNING: This will delete ALL existing members, accounts, and demand notices from the new database. Are you sure?")) return;
    if (!window.confirm("FINAL WARNING: This action cannot be undone. Type 'OK' if you want to proceed.") ) return;

    setLoading(true);
    setMessage('Deleting existing customer data...');
    try {
      const response = await fetch('/api/LegacyDataImport/clear-existing-data', { method: 'DELETE' });
      const data = await response.json();
      if (response.ok) {
        setMessage(`Success: ${data.message}`);
      } else {
        setMessage(`Error: ${data.message}`);
      }
    } catch (error: any) {
      setMessage(`Network error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Group Legacy Ledgers
  const legacyGroups = useMemo(() => {
    const groups: { [key: string]: LegacyLedger[] } = {};
    legacyLedgers.forEach(ll => {
      const gName = ll.groupName || 'Uncategorized';
      if (!groups[gName]) groups[gName] = [];
      groups[gName].push(ll);
    });
    return groups;
  }, [legacyLedgers]);

  return (
    <div className="p-3 max-w-5xl mx-auto font-sans">
      <div className="mb-3 pb-2 border-b-2 border-primary flex justify-between items-end">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Legacy Database Import (FinEx)</h1>
          <p className="text-gray-500 text-xs mt-0.5">Migrate your data from the legacy FinEx system.</p>
        </div>
        <div>
          <button onClick={clearExistingData} disabled={loading} className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-1 rounded-sm text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1">
            ⚠️ Clear Existing Data
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-3 p-2 rounded-sm text-xs font-medium flex items-center gap-2 shadow-sm ${message.includes('Error') ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
          {loading && <Loader2 className="animate-spin text-primary" size={14} />}
          {message}
        </div>
      )}

      {/* STEP 0: UPLOAD */}
      <div className={`bg-white p-3 rounded-sm shadow-sm border mb-3 transition-all duration-300 ${activeStep === 0 ? 'border-primary ring-1 ring-primary/20' : 'border-gray-200'}`}>
        <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
          <span className={`flex items-center justify-center w-5 h-5 rounded-full text-xs ${activeStep > 0 ? 'bg-green-100 text-green-600' : 'bg-primary/10 text-primary'}`}>
            {activeStep > 0 ? <CheckCircle2 size={12} /> : '0'}
          </span>
          Step 0: Upload Database
        </h3>
        {activeStep === 0 && (
          <div className="pl-7">
            <label className="block text-xs font-semibold text-gray-700 mb-1">Select Legacy Database File (.mdf)</label>
            <div className="flex gap-2 items-center">
              <input type="file" accept=".mdf,.bak,.sql" onChange={handleFileChange} className="border border-gray-300 bg-gray-50 px-2 py-1 rounded-sm focus:outline-none focus:ring-1 focus:ring-primary/20 text-xs w-full md:w-1/2 transition-all" />
              <button onClick={uploadAndTestConnection} disabled={loading || !file} className="bg-gray-700 hover:bg-gray-800 text-white px-3 py-1 rounded-sm text-xs font-medium shadow-sm transition-colors disabled:opacity-50 whitespace-nowrap">
                Upload & Test Connection
              </button>
            </div>
          </div>
        )}
      </div>

      {/* STEP 1: FINANCIAL YEARS & MASTERS */}
      <div className={`bg-white p-3 rounded-sm shadow-sm border mb-3 transition-all duration-300 ${activeStep === 1 ? 'border-primary ring-1 ring-primary/20' : 'border-gray-200'} ${activeStep < 1 ? 'opacity-50 pointer-events-none' : ''}`}>
        <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
          <span className={`flex items-center justify-center w-5 h-5 rounded-full text-xs ${activeStep > 1 ? 'bg-green-100 text-green-600' : 'bg-primary/10 text-primary'}`}>
            {activeStep > 1 ? <CheckCircle2 size={12} /> : '1'}
          </span>
          Step 1: Masters & Financial Year
        </h3>
        {activeStep === 1 && (
          <div className="pl-7 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-blue-50/50 p-3 rounded-sm border border-blue-100">
              <p className="text-xs text-gray-600 mb-2">First, fetch the financial years from the legacy database.</p>
              <button onClick={importFinancialYears} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-sm text-xs font-medium w-full mb-3 shadow-sm transition-colors">
                Fetch Financial Years
              </button>
              
              {financialYears.length > 0 && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-xs font-semibold text-gray-800 mb-1">Select Target Financial Year</label>
                  <select 
                    value={selectedFinancialYearId} 
                    onChange={e => setSelectedFinancialYearId(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:ring-1 focus:ring-primary/20 focus:border-primary outline-none transition-all bg-white"
                  >
                    <option value={0}>-- Select Financial Year --</option>
                    {financialYears.map(fy => (
                      <option key={fy.financialYearID} value={fy.financialYearID}>{fy.yearCode} (From {new Date(fy.startDate).toLocaleDateString()})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="bg-green-50/50 p-3 rounded-sm border border-green-100 flex flex-col justify-center">
              <p className="text-xs text-gray-600 mb-2 text-center">After selecting the financial year, import the Employers and Account Groups.</p>
              <button onClick={importMasters} disabled={loading || selectedFinancialYearId === 0} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-sm text-xs font-bold w-full shadow-sm transition-colors">
                Import Masters & Proceed
              </button>
            </div>
          </div>
        )}
      </div>

      {/* STEP 2: LEDGER MAPPING */}
      <div className={`bg-white p-3 rounded-sm shadow-sm border mb-3 transition-all duration-300 ${activeStep === 2 ? 'border-primary ring-1 ring-primary/20' : 'border-gray-200'} ${activeStep < 2 ? 'opacity-50 pointer-events-none' : ''}`}>
        <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
          <span className={`flex items-center justify-center w-5 h-5 rounded-full text-xs ${activeStep > 2 ? 'bg-green-100 text-green-600' : 'bg-primary/10 text-primary'}`}>
            {activeStep > 2 ? <CheckCircle2 size={12} /> : '2'}
          </span>
          Step 2: Ledger Mapping
        </h3>
        {activeStep === 2 && (
          <div className="pl-7">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 p-2 bg-gray-50 rounded-sm border border-gray-200">
              <p className="text-xs text-gray-600">
                Map the <span className="font-semibold text-gray-800">Old Ledgers</span> (from FinEx) to the <span className="font-semibold text-gray-800">New System Ledgers</span>. <br/>
                Ledgers left unmapped will not be imported until you map them or create them.
              </p>
              <button onClick={previewLedgers} disabled={loading} className="bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 px-3 py-1 rounded-sm text-xs font-semibold shadow-sm flex items-center gap-1 whitespace-nowrap transition-colors">
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh List
              </button>
            </div>
            
            <div className="max-h-[400px] overflow-y-auto border border-gray-300 rounded-sm mb-3 shadow-sm bg-white">
              <table className="w-full text-xs text-left table-fixed">
                <tbody>
                {Object.keys(legacyGroups).map((gName, idx) => (
                  <React.Fragment key={idx}>
                    <tr>
                      <td colSpan={2} className="bg-primary text-white px-2 py-1 font-semibold sticky top-0 z-10 border-y border-gray-300 first:border-t-0">
                        {gName}
                      </td>
                    </tr>
                    {legacyGroups[gName].map((ll) => (
                      <tr key={ll.legacyId} className="border-b border-gray-200 hover:bg-blue-50/50 transition-colors">
                        <td className="px-2 py-1.5 font-medium text-gray-700 w-1/2 break-words border-r border-gray-200">
                          {ll.name} <span className="text-[10px] text-gray-500 font-normal ml-1">({ll.legacyId})</span>
                        </td>
                        <td className="px-2 py-1 w-1/2 overflow-visible">
                          <Select 
                            options={groupedLedgerOptions}
                            isClearable
                            placeholder="Search new ledger..."
                            value={groupedLedgerOptions.flatMap(g => g.options).find(o => o.value === mappedLedgers[ll.legacyId]) || null}
                            onChange={(selected) => handleMapChange(ll.legacyId, selected ? selected.value : null)}
                            styles={{ 
                              menuPortal: base => ({ ...base, zIndex: 9999 }),
                              control: base => ({ ...base, borderRadius: '2px', borderColor: '#D1D5DB', minHeight: '28px' }),
                              dropdownIndicator: base => ({ ...base, padding: '2px' }),
                              clearIndicator: base => ({ ...base, padding: '2px' }),
                              valueContainer: base => ({ ...base, padding: '0px 6px' }),
                              input: base => ({ ...base, margin: '0px', padding: '0px' })
                            }}
                            menuPortalTarget={document.body}
                          />
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <button onClick={syncLedgers} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded-sm text-xs font-bold shadow-sm transition-colors">
                Save Mappings
              </button>
              <button onClick={() => setActiveStep(3)} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded-sm text-xs font-bold shadow-sm ml-auto transition-colors">
                Next: Proceed to Step 3 ➔
              </button>
            </div>
          </div>
        )}
      </div>

      {/* STEP 3: MEMBERS & ACCOUNTS */}
      <div className={`bg-white p-3 rounded-sm shadow-sm border mb-3 transition-all duration-300 ${activeStep === 3 ? 'border-primary ring-1 ring-primary/20' : 'border-gray-200'} ${activeStep < 3 ? 'opacity-50 pointer-events-none' : ''}`}>
        <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
          <span className={`flex items-center justify-center w-5 h-5 rounded-full text-xs ${activeStep > 3 ? 'bg-green-100 text-green-600' : 'bg-primary/10 text-primary'}`}>
            {activeStep > 3 ? <CheckCircle2 size={12} /> : '3'}
          </span>
          Step 3: Members & Personal Accounts
        </h3>
        {activeStep === 3 && (
          <div className="pl-7">
            <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-sm mb-3">
              <p className="text-xs text-indigo-800">
                Import all Members, their Profile Details, and their associated Loan/Deposit accounts. 
                <br/>The accounts will be linked to the Financial Year you selected earlier.
              </p>
            </div>
            <button onClick={importMembersAndAccounts} disabled={loading} className="bg-primary hover:bg-primary-dark text-white px-4 py-1.5 rounded-sm text-xs font-bold shadow-sm transition-colors w-full sm:w-auto">
              Start Phase 1 Import (Members & Accounts)
            </button>
          </div>
        )}
      </div>

      {/* STEP 4: FINANCIAL DATA (OPENING BALANCES & TRANSACTIONS) */}
      <div className={`bg-white p-3 rounded-sm shadow-sm border mb-3 transition-all duration-300 ${activeStep === 4 ? 'border-primary ring-1 ring-primary/20' : 'border-gray-200'} ${activeStep < 4 ? 'opacity-50 pointer-events-none' : ''}`}>
        <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
          <span className={`flex items-center justify-center w-5 h-5 rounded-full text-xs ${activeStep > 4 ? 'bg-green-100 text-green-600' : 'bg-primary/10 text-primary'}`}>
            {activeStep > 4 ? <CheckCircle2 size={12} /> : '4'}
          </span>
          Step 4: Financial Data (Opening Balances & Transactions)
        </h3>
        {activeStep === 4 && (
          <div className="pl-7">
            <div className="bg-orange-50 border border-orange-100 p-3 rounded-sm mb-3">
              <p className="text-xs text-orange-800">
                Import Ledger Opening Balances from FinEx and all Transactions (Vouchers) into the new system.
                <br/>This will populate the Trial Balance and Daybook.
              </p>
            </div>
            <button onClick={importFinancialData} disabled={loading} className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-1.5 rounded-sm text-xs font-bold shadow-sm transition-colors w-full sm:w-auto">
              Start Phase 2 Import (Transactions & Balances)
            </button>
          </div>
        )}
      </div>

      {activeStep === 5 && (
        <div className="bg-green-50 p-4 rounded-sm text-center border border-green-200 shadow-sm animate-in zoom-in-95 duration-300">
          <div className="bg-green-500 text-white w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
            <CheckCircle2 size={20} />
          </div>
          <h2 className="text-lg font-bold text-green-800 mb-1">Data Migration Completed!</h2>
          <p className="text-green-700 text-xs font-medium">All masters, ledgers, accounts, opening balances, and transactions have been successfully imported.<br/>You can now check your Trial Balance and other financial reports.</p>
        </div>
      )}

    </div>
  );
}

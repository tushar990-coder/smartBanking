import React, { useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const DataImportMaster: React.FC = () => {
  const [selectedModule, setSelectedModule] = useState('members');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('1');

  const API_URL = '/api/DataImport';

  React.useEffect(() => {
    let isMounted = true;
    axios.get('/api/Branches').then(res => {
      if (isMounted) {
        setBranches(res.data);
        if (res.data.length > 0) {
          setSelectedBranch(res.data[0].branchID.toString());
        }
      }
    }).catch(err => console.error(err));
    return () => { isMounted = false; };
  }, []);

  const modules = [
    { id: 'members', name: 'सभासद माहिती (Member Master)', endpoint: 'Members' },
    { id: 'savingBalances', name: 'बचत खाते आणि शिल्लक (Saving Accounts & Balance)', endpoint: 'SavingAccounts' },
    { id: 'shareBalances', name: 'शेअर्स आणि शिल्लक (Share Accounts & Balance)', endpoint: 'ShareAccounts' },
    { id: 'loanBalances', name: 'कर्ज खाते आणि बाकी (Loan Accounts & Balance)', customUrl: '/api/LoanAccounts/Import' },
  ];

  const handleDownloadTemplate = () => {
    let data: any[] = [];
    let fileName = '';

    if (selectedModule === 'members') {
      data = [{
        MemberCode: '', // Optional - system will auto-generate if empty
        LegacyMemberNo: '101',
        FirstName: 'रमेश',
        MiddleName: 'सुरेश',
        LastName: 'पाटील',
        FirstNameEng: 'Ramesh',
        MiddleNameEng: 'Suresh',
        LastNameEng: 'Patil',
        MobileNo: '9876543210',
        AadhaarNo: '123456789012',
        PANNo: 'ABCDE1234F',
        Address: 'मुख्य रस्ता',
        AddressEng: 'Main Street',
        Village: 'Pune',
        Taluka: 'Haveli',
        District: 'Pune',
        Gender: 'Male',
        BirthDate: '1985-05-15',
        JoiningDate: '2020-01-01',
        Occupation: 'Farmer',
        NomineeName: 'सुरेश पाटील',
        NomineeNameEng: 'Suresh Patil',
        NomineeRelation: 'Son',
        CasteCategory: 'Open',
        Caste: 'मराठा',
        Email: 'ramesh@example.com',
        IsMinor: false,
        GuardianName: '',
        GuardianNameEng: '',
        GuardianRelation: '',
        GuardianAadhaarNo: '',
        GuardianMobileNo: '',
        GuardianAddress: '',
        Status: 'Active',
        EmployerName: ''
      }];
      fileName = 'Member_Import_Template.xlsx';
    } else if (selectedModule === 'savingBalances') {
      data = [{
        Old_CIF_No: 'M001',
        Old_Saving_Account_No: 'SAV001',
        Scheme_Name: 'बचत ठेव',
        Balance_As_On_31_03: 5000
      }];
      fileName = 'Saving_Balance_Import_Template.xlsx';
    } else if (selectedModule === 'shareBalances') {
      data = [{
        MemberCode: 'M001',
        MemberName: 'Ramesh Patil',
        AccountNo: 'SHR001',
        OpeningDate: '2023-03-31',
        TotalShareCount: 10,
        TotalShareAmount: 1000,
        DividendPayableBalance: 0
      }];
      fileName = 'Share_Balance_Import_Template.xlsx';
    } else if (selectedModule === 'loanBalances') {
      data = [{
        Old_CIF_No: 'M001',
        Scheme_Name: 'वैयक्तिक कर्ज',
        Old_Loan_Account_No: 'LOAN001',
        Opening_Date: '2023-01-01',
        First_Installment_Date: '2023-02-01',
        Sanctioned_Amount: 50000,
        Principal_Balance_31_03: 20000,
        Interest_Balance_31_03: 500,
        Overdue_Interest_31_03: 0,
        Duration_Months: 36,
        Interest_Rate: 12.0,
        Installment_Amount: 1660,
        Installment_Frequency: 'मासिक (Monthly)',
        Total_No_Of_Installments: 36
      }];
      fileName = 'Loan_Balance_Import_Template.xlsx';
    }

    if (data.length > 0) {
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
      XLSX.writeFile(workbook, fileName);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage('कृपया अपलोड करण्यासाठी Excel फाईल निवडा.');
      return;
    }

    setLoading(true);
    setMessage('');
    setErrorDetails([]);

    const reader = new FileReader();
    reader.onload = async (e) => {
      let jsonData: any[] = [];
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(sheet);
        
        const parseToDateString = (val: any): string | null => {
          if (!val) return null;
          if (val instanceof Date) return val.toISOString().split('T')[0];
          const str = String(val).trim();
          if (!str) return null;
          
          const dmYMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
          if (dmYMatch) {
            return `${dmYMatch[3]}-${dmYMatch[2].padStart(2, '0')}-${dmYMatch[1].padStart(2, '0')}`;
          }
          
          const yMdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
          if (yMdMatch) {
            return `${yMdMatch[1]}-${yMdMatch[2].padStart(2, '0')}-${yMdMatch[3].padStart(2, '0')}`;
          }
          
          const parsed = new Date(str);
          if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().split('T')[0];
          }
          return null;
        };

        const toStringOrNull = (val: any): string | null => {
          if (val === undefined || val === null) return null;
          const str = String(val).trim();
          return str === '' ? null : str;
        };

        const toStringOrEmpty = (val: any): string => {
          if (val === undefined || val === null) return '';
          return String(val).trim();
        };

        jsonData = rawData.map((row: any) => {
          const newRow: any = {};
          
          // Normalize header keys (lowercase without spaces/underscores)
          Object.keys(row).forEach(key => {
            const cleanKey = key.trim().toLowerCase().replace(/[\s\_]+/g, '');
            newRow[cleanKey] = row[key];
            newRow[key] = row[key]; // keep original
          });

          // Flexible key mappings with strict String conversion
          newRow.MemberCode = toStringOrEmpty(newRow.membercode || newRow.oldmembercode || newRow.oldcifno || newRow.cifno || newRow.code || newRow.MemberCode);
          newRow.LegacyMemberNo = toStringOrNull(newRow.legacymemberno || newRow.legacyid || newRow.oldid || newRow.LegacyMemberNo);
          newRow.CIFNo = toStringOrNull(newRow.cifno || newRow.CIFNo);
          newRow.FirstName = toStringOrEmpty(newRow.firstname || newRow.pahilenav || newRow.FirstName);
          newRow.MiddleName = toStringOrNull(newRow.middlename || newRow.madhlenav || newRow.MiddleName);
          newRow.LastName = toStringOrEmpty(newRow.lastname || newRow.adnav || newRow.LastName);
          newRow.MobileNo = toStringOrEmpty(newRow.mobileno || newRow.mobile || newRow.MobileNo);
          newRow.AadhaarNo = toStringOrEmpty(newRow.aadhaarno || newRow.aadhar || newRow.aadhaar || newRow.AadhaarNo);
          newRow.PANNo = toStringOrNull(newRow.panno || newRow.pan || newRow.PANNo);
          newRow.Address = toStringOrNull(newRow.address || newRow.patta || newRow.Address);
          newRow.Village = toStringOrNull(newRow.village || newRow.gav || newRow.Village);
          newRow.Taluka = toStringOrNull(newRow.taluka || newRow.Taluka);
          newRow.District = toStringOrNull(newRow.district || newRow.jilha || newRow.District);
          newRow.Gender = toStringOrNull(newRow.gender || newRow.ling || newRow.Gender);
          newRow.Occupation = toStringOrNull(newRow.occupation || newRow.vyavasay || newRow.Occupation);
          newRow.NomineeName = toStringOrNull(newRow.nomineename || newRow.varasdar || newRow.NomineeName);
          newRow.NomineeRelation = toStringOrNull(newRow.nomineerelation || newRow.nate || newRow.NomineeRelation);
          newRow.CasteCategory = toStringOrNull(newRow.castecategory || newRow.category || newRow.vargavari || newRow.CasteCategory);
          newRow.Caste = toStringOrNull(newRow.caste || newRow.jat || newRow.Caste);
          newRow.Email = toStringOrNull(newRow.email || newRow.emailid || newRow.Email);
          newRow.IsMinor = newRow.isminor === true || String(newRow.isminor).toLowerCase() === 'true' || String(newRow.isminor).toLowerCase() === 'yes';
          newRow.GuardianName = toStringOrNull(newRow.guardianname || newRow.palaknav || newRow.GuardianName);
          newRow.GuardianNameEng = toStringOrNull(newRow.guardiannameeng || newRow.GuardianNameEng);
          newRow.GuardianRelation = toStringOrNull(newRow.guardianrelation || newRow.palaknate || newRow.GuardianRelation);
          newRow.GuardianAadhaarNo = toStringOrNull(newRow.guardianaadhaarno || newRow.palakaadhaar || newRow.GuardianAadhaarNo);
          newRow.GuardianMobileNo = toStringOrNull(newRow.guardianmobileno || newRow.palakmobile || newRow.GuardianMobileNo);
          newRow.GuardianAddress = toStringOrNull(newRow.guardianaddress || newRow.palakpatta || newRow.GuardianAddress);
          newRow.Status = toStringOrNull(newRow.status || newRow.Status);
          newRow.EmployerName = toStringOrNull(newRow.employername || newRow.employer || newRow.EmployerName);
          
          // Saving mappings
          if (newRow.oldcifno !== undefined) newRow.MemberCode = toStringOrEmpty(newRow.oldcifno);
          if (newRow.oldsavingaccountno !== undefined) newRow.AccountNo = toStringOrEmpty(newRow.oldsavingaccountno);
          if (newRow.schemename !== undefined) newRow.SchemeName = toStringOrEmpty(newRow.schemename);
          if (newRow.balanceason3103 !== undefined) newRow.OpeningBalance = Number(newRow.balanceason3103);
          if (newRow.AccountNo !== undefined) newRow.AccountNo = toStringOrEmpty(newRow.AccountNo);

          // Loan mappings
          if (newRow.oldloanaccountno !== undefined) newRow.LoanAccountNo = toStringOrEmpty(newRow.oldloanaccountno);
          if (newRow.openingdate !== undefined) newRow.OpeningDate = newRow.openingdate;
          if (newRow.firstinstallmentdate !== undefined) newRow.FirstInstallmentDate = newRow.firstinstallmentdate;
          if (newRow.sanctionedamount !== undefined) newRow.SanctionedAmount = Number(newRow.sanctionedamount);
          if (newRow.principalbalance3103 !== undefined) newRow.PrincipalBalance = Number(newRow.principalbalance3103);
          if (newRow.interestbalance3103 !== undefined) newRow.InterestBalance = Number(newRow.interestbalance3103);
          if (newRow.overdueinterest3103 !== undefined) newRow.OverdueInterestBalance = Number(newRow.overdueinterest3103);
          if (newRow.durationmonths !== undefined) newRow.DurationMonths = Number(newRow.durationmonths);
          if (newRow.interestrate !== undefined) newRow.InterestRate = Number(newRow.interestrate);
          if (newRow.installmentamount !== undefined) newRow.InstallmentAmount = Number(newRow.installmentamount);
          if (newRow.installmentfrequency !== undefined) newRow.InstallmentFrequency = toStringOrEmpty(newRow.installmentfrequency);
          if (newRow.totalnoofinstallments !== undefined) newRow.NoOfInstallments = Number(newRow.totalnoofinstallments);

          // Parse Date properties intelligently
          newRow.OpeningDate = parseToDateString(newRow.OpeningDate || newRow.openingdate);
          newRow.FirstInstallmentDate = parseToDateString(newRow.FirstInstallmentDate || newRow.firstinstallmentdate);
          newRow.JoiningDate = parseToDateString(newRow.JoiningDate || newRow.joiningdate);
          newRow.BirthDate = parseToDateString(newRow.BirthDate || newRow.birthdate);

          // Delete raw normalized keys so they don't pass raw numbers to ASP.NET Core System.Text.Json
          delete newRow.legacymemberno;
          delete newRow.legacyid;
          delete newRow.oldid;
          delete newRow.membercode;
          delete newRow.oldmembercode;
          delete newRow.oldcifno;
          delete newRow.cifno;
          delete newRow.firstname;
          delete newRow.pahilenav;
          delete newRow.middlename;
          delete newRow.madhlenav;
          delete newRow.lastname;
          delete newRow.adnav;
          delete newRow.mobileno;
          delete newRow.mobile;
          delete newRow.aadhaarno;
          delete newRow.aadhar;
          delete newRow.aadhaar;
          delete newRow.panno;
          delete newRow.pan;
          delete newRow.patta;
          delete newRow.gav;
          delete newRow.jilha;
          delete newRow.ling;
          delete newRow.vyavasay;
          delete newRow.varasdar;
          delete newRow.nate;

          return newRow;
        });

        if (jsonData.length === 0) {
          setMessage('फाईलमध्ये कोणताही डेटा आढळला नाही.');
          setLoading(false);
          return;
        }

        const selectedModuleObj = modules.find(m => m.id === selectedModule);
        if (!selectedModuleObj) return;

        let uploadUrl = (selectedModuleObj as any).customUrl || `${API_URL}/${selectedModuleObj.endpoint}?branchId=${selectedBranch}`;

        const response = await axios.post(uploadUrl, jsonData);

        setMessage(`यशस्वी! एकूण ${response.data.successCount} रेकॉर्ड्स इम्पोर्ट झाले.`);
        setFile(null);
        // Reset file input
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';

      } catch (err: any) {
        setMessage('डेटा इम्पोर्ट करताना त्रुटी आली. कृपया खालील तपशील पहा.');
        let parsedErrors: string[] = [];

        if (err.response && err.response.data) {
          const data = err.response.data;
          
          if (typeof data === 'string' && data.trim()) {
            parsedErrors = [data.trim()];
          } else if (typeof data === 'object' && data !== null) {
            if (data.errors) {
              if (Array.isArray(data.errors)) {
                parsedErrors = data.errors.map((e: any) => String(e));
              } else if (typeof data.errors === 'object') {
                parsedErrors = Object.entries(data.errors).map(([key, msgs]) => {
                  const match = key.match(/\[(\d+)\]\.(.*)/);
                  const msgStr = Array.isArray(msgs) ? msgs.join(', ') : String(msgs);
                  if (match) {
                    return `Row ${parseInt(match[1]) + 2}: ${match[2]} - ${msgStr}`;
                  }
                  return `${key}: ${msgStr}`;
                });
              }
            } else if (data.message) {
              parsedErrors = [typeof data.message === 'string' ? data.message : JSON.stringify(data.message)];
            } else if (data.title) {
              parsedErrors = [typeof data.title === 'string' ? data.title : JSON.stringify(data.title)];
            } else if (data.detail) {
              parsedErrors = [typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)];
            }
          }
        }

        if (parsedErrors.length === 0) {
          if (err.message) {
            parsedErrors = [err.message];
          } else {
            parsedErrors = ['अज्ञात त्रुटी (Unknown Error)'];
          }
        }

        setErrorDetails(parsedErrors);

          // Generate Error Excel
          if (parsedErrors.length > 0 && jsonData.length > 0) {
            try {
              const wb = new ExcelJS.Workbook();
              const ws = wb.addWorksheet('Errors');
              
              const headers = Object.keys(jsonData[0]);
              headers.push('Error_Details');
              ws.columns = headers.map(h => ({ header: h, key: h, width: 20 }));

              const errorMap = new Map<number, string[]>();
              parsedErrors.forEach(msg => {
                const match = msg.match(/Row (\d+): (.*)/);
                if (match) {
                  const rowIndex = parseInt(match[1]) - 2;
                  if (!errorMap.has(rowIndex)) errorMap.set(rowIndex, []);
                  errorMap.get(rowIndex)!.push(match[2]);
                }
              });

              jsonData.forEach((row, index) => {
                const rowData = { ...row };
                const errors = errorMap.get(index);
                if (errors) {
                  rowData['Error_Details'] = errors.join(' | ');
                }
                const addedRow = ws.addRow(rowData);
                if (errors) {
                  addedRow.eachCell((cell) => {
                    cell.fill = {
                      type: 'pattern',
                      pattern: 'solid',
                      fgColor: { argb: 'FFFFCCCC' } // Light red
                    };
                    cell.font = {
                      color: { argb: 'FF990000' }, // Dark red
                      bold: true
                    };
                  });
                }
              });

              ws.getRow(1).font = { bold: true };
              ws.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFDDDDDD' }
              };

              const buffer = await wb.xlsx.writeBuffer();
              saveAs(new Blob([buffer]), 'Import_Errors.xlsx');
              alert("तुमच्या फाईलमध्ये काही चुका आहेत. लाल रंगाने हायलाईट केलेली नवीन फाईल डाऊनलोड होत आहे. कृपया ती तपासून पहा.");
            } catch (ex) {
              console.error('Failed to generate error excel', ex);
            }
          }
        } finally {
          setLoading(false);
        }
      };
      reader.readAsBinaryString(file);
    };

  return (
    <div className="p-3 max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="bg-white p-2.5 rounded-sm shadow-sm border border-gray-200">
        <h1 className="text-base font-bold text-primary">डेटा इम्पोर्ट हब (Data Import Hub)</h1>
        <p className="text-[10px] text-gray-500">Excel फाईल वापरून मोठ्या प्रमाणावर डेटा सॉफ्टवेअरमध्ये अपलोड करण्यासाठी या सुविधेचा वापर करा.</p>
      </div>

      <div className="bg-white p-4 rounded-sm shadow-sm border border-gray-200 space-y-4">
        
        {/* Module Selection */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">कोणत्या मॉड्यूलचा डेटा इम्पोर्ट करायचा आहे? (Select Module)</label>
          <select 
            value={selectedModule} 
            onChange={(e) => setSelectedModule(e.target.value)}
            className="w-full md:w-1/2 border border-gray-300 px-2 py-1.5 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs"
          >
            {modules.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* Branch Selection */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">कोणत्या शाखेसाठी (Branch) डेटा इम्पोर्ट करायचा आहे?</label>
          <select 
            value={selectedBranch} 
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="w-full md:w-1/2 border border-gray-300 px-2 py-1.5 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs"
          >
            {branches.map(b => (
              <option key={b.branchID} value={b.branchID}>{b.branchName}</option>
            ))}
          </select>
        </div>

        {/* Step 1: Download Template */}
        <div className="border border-blue-200 bg-blue-50/30 p-3 rounded-sm flex flex-col md:flex-row items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-blue-800">१. सॅम्पल फाईल डाउनलोड करा (Download Template)</h3>
            <p className="text-xs text-blue-600 mt-1">सर्वप्रथम सॅम्पल Excel फाईल डाउनलोड करा आणि त्या फॉरमॅटमध्येच तुमचा डेटा भरा.</p>
          </div>
          <button 
            onClick={handleDownloadTemplate}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-sm font-medium shadow-sm transition-colors text-xs flex items-center gap-1 whitespace-nowrap"
          >
            <span>⬇️</span> डाउनलोड (Download)
          </button>
        </div>

        {/* Step 2: Upload Data */}
        <div className="border border-green-200 bg-green-50/30 p-3 rounded-sm">
          <h3 className="text-sm font-bold text-green-800 mb-2">२. फाईल अपलोड करा (Upload Data)</h3>
          <div className="flex flex-col md:flex-row items-center gap-3">
            <input 
              id="file-upload"
              type="file" 
              accept=".xlsx, .xls" 
              onChange={handleFileChange}
              className="text-xs w-full md:w-auto file:mr-4 file:py-1 file:px-3 file:rounded-sm file:border-0 file:text-xs file:font-semibold file:bg-green-100 file:text-green-700 hover:file:bg-green-200"
            />
            <button 
              onClick={handleUpload}
              disabled={loading || !file}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-1.5 rounded-sm font-bold shadow-sm transition-colors text-xs flex items-center gap-1"
            >
              {loading ? 'अपलोड होत आहे...' : '⬆️ अपलोड करा (Upload)'}
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {message && (
          <div className={`p-2 rounded-sm text-xs font-semibold ${message.includes('यशस्वी') ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
            {message}
          </div>
        )}

        {/* Error Details */}
        {errorDetails.length > 0 && (
          <div className="mt-2 bg-red-50 border border-red-200 rounded-sm p-2">
            <h4 className="text-xs font-bold text-red-700 mb-1">खालील त्रुटी (Errors) दुरुस्त करा:</h4>
            <ul className="list-disc list-inside text-[11px] text-red-600 space-y-0.5 max-h-40 overflow-y-auto">
              {errorDetails.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

      </div>
    </div>
  );
};

export default DataImportMaster;

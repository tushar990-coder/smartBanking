import React from 'react';
import Select from 'react-select';

export interface MemberOption {
  memberID: number;
  memberCode: string;
  legacyMemberNo?: string;
  oldMemberCode?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  mobileNo?: string;
  aadhaarNo?: string;
  cifNo?: string;
  status?: string;
}

interface Props {
  members: (MemberOption | any)[];
  value: number | string | '' | undefined;
  onChange: (memberId: number | '') => void;
  placeholder?: string;
  className?: string;
  isDisabled?: boolean;
  isClearable?: boolean;
  required?: boolean;
}

export default function MemberSearchSelect({
  members = [],
  value,
  onChange,
  placeholder = "-- सभासद निवडा --",
  className = "",
  isDisabled = false,
  isClearable = true
}: Props) {
  
  // Transform members into react-select options format
  const options = React.useMemo(() => {
    if (!Array.isArray(members)) return [];
    return members.map((m: any) => {
      const mId = Number(m.memberID || m.memberId || m.MemberID || m.customerID || m.customerId || m.CustomerID || m.id || 0);
      const code = (m.memberCode || m.code || m.MemberCode || '').trim();
      const legacyNo = (m.legacyMemberNo || m.oldMemberCode || m.oldMemberNo || m.LegacyMemberNo || m.legacyCustomerNo || m.LegacyCustomerNo || '').trim();
      const cif = (m.cifNo || m.cif || m.CifNo || m.CIFNo || '').trim();
      const mobile = (m.mobileNo || m.mobile || m.MobileNo || m.mobileNumber || '').trim();
      const aadhaar = (m.aadhaarNo || m.aadhaar || m.AadhaarNo || '').trim();

      const fName = (m.firstName || m.FirstName || m.firstNameEng || m.FirstNameEng || '').trim();
      const mName = (m.middleName || m.MiddleName || m.middleNameEng || m.MiddleNameEng || '').trim();
      const lName = (m.lastName || m.LastName || m.lastNameEng || m.LastNameEng || '').trim();
      const nick = (m.nickName || m.NickName || '').trim();

      let fullName = (m.fullName || m.FullName || m.name || m.Name || m.customerName || m.CustomerName || '').trim();
      if (!fullName) {
        fullName = [fName, mName, lName].filter(Boolean).join(' ').trim();
      }
      if (!fullName) {
        fullName = `सभासद / खातेदार #${mId}`;
      }

      let codeDisplay = code && !code.startsWith('TEMP') ? code : (cif || `ID:${mId}`);
      if (legacyNo) {
        codeDisplay += ` (जुना:${legacyNo})`;
      }

      const label = `[${codeDisplay}] ${fullName}${nick ? ` (${nick})` : ''}${mobile ? ` - ${mobile}` : ''}`;

      return {
        value: mId,
        label: label,
        member: {
          ...m,
          memberID: mId,
          customerID: Number(m.customerID || m.customerId || m.CustomerID || mId),
          memberCode: code,
          legacyMemberNo: legacyNo,
          cifNo: cif,
          mobileNo: mobile,
          aadhaarNo: aadhaar,
          firstName: fName,
          middleName: mName,
          lastName: lName,
          nickName: nick,
          fullName: fullName
        }
      };
    });
  }, [members]);

  const numericValue = value !== '' && value !== undefined && value !== null ? Number(value) : '';

  const selectedOption = React.useMemo(() => {
    if (numericValue === '' || isNaN(numericValue as number)) return null;
    return options.find(o => o.value === numericValue) || null;
  }, [numericValue, options]);

  // Custom filter logic to search by name, mobile, aadhaar, cif, code, and legacy number
  const filterOption = (option: any, rawInput: string) => {
    const input = rawInput.toLowerCase().trim();
    if (!input) return true;
    
    const { label, member } = option.data;
    const searchString = `
      ${label}
      ${member.fullName || ''}
      ${member.firstName || ''}
      ${member.middleName || ''}
      ${member.lastName || ''}
      ${member.nickName || ''}
      ${member.mobileNo || ''}
      ${member.aadhaarNo || ''}
      ${member.cifNo || ''}
      ${member.memberCode || ''}
      ${member.legacyMemberNo || ''}
      ${member.memberID || ''}
      ${member.customerID || ''}
    `.toLowerCase();
    
    // Also support searching numeric parts of member code or CIF (e.g. searching '1069' matches CIF 'CIF001069' or ID 1069)
    const codeNum = (member.memberCode || '').replace(/\D/g, '');
    const cifNum = (member.cifNo || '').replace(/\D/g, '');
    const cleanInput = input.replace(/\D/g, '');
    if (cleanInput) {
      if (codeNum && (codeNum.includes(cleanInput) || parseInt(codeNum) === parseInt(cleanInput))) return true;
      if (cifNum && (cifNum.includes(cleanInput) || parseInt(cifNum) === parseInt(cleanInput))) return true;
      if (member.memberID && member.memberID.toString().includes(cleanInput)) return true;
      if (member.customerID && member.customerID.toString().includes(cleanInput)) return true;
    }

    return searchString.includes(input);
  };

  const formatOptionLabel = (data: any, { context }: any) => {
    const m = data.member;
    const fullName = m.fullName || `${m.firstName || ''} ${m.middleName ? m.middleName + ' ' : ''}${m.lastName || ''}`.trim() || `सभासद #${m.memberID}`;
    const code = m.memberCode && !m.memberCode.startsWith('TEMP') ? m.memberCode : (m.cifNo || `ID:${m.memberID}`);

    if (context === 'value') {
      return (
        <div className="flex items-center gap-1.5 overflow-hidden text-[11px] py-0.5 w-full">
          <span className="text-[10px] text-emerald-900 font-mono font-black shrink-0 bg-emerald-100 border border-emerald-300 px-1 py-0.2 rounded">
            {code}
          </span>
          <span className="font-black text-slate-900 truncate">
            {fullName}
          </span>
          {m.cifNo && m.cifNo !== code && (
            <span className="text-[9.5px] text-sky-900 font-mono font-bold shrink-0 bg-sky-100 border border-sky-300 px-1 py-0.2 rounded hidden sm:inline">
              CIF: {m.cifNo}
            </span>
          )}
          {m.legacyMemberNo && (
            <span className="text-[9.5px] text-amber-900 font-mono font-bold shrink-0 bg-amber-100 border border-amber-300 px-1 py-0.2 rounded hidden sm:inline">
              (जुना: {m.legacyMemberNo})
            </span>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between py-1 px-1 w-full gap-3 hover:bg-transparent">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-1.5 py-0.5 rounded font-mono font-black text-[10px] shrink-0">
            {code}
          </span>
          <span className="font-black text-slate-900 text-xs leading-tight">
            {fullName}
          </span>
          {m.nickName && (
            <span className="text-[10px] text-slate-500 italic shrink-0">
              ({m.nickName})
            </span>
          )}
          {m.mobileNo && (
            <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-1">
              📱 {m.mobileNo}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
          <span className="bg-sky-100 text-sky-900 border border-sky-300 px-1.5 py-0.5 rounded font-bold font-mono">
            Cust ID: #{m.memberID}
          </span>
          {m.cifNo && m.cifNo.trim() !== '' && code !== m.cifNo && (
            <span className="bg-slate-100 text-slate-700 border border-slate-300 px-1.5 py-0.5 rounded font-mono text-[9.5px]">
              CIF: {m.cifNo.trim()}
            </span>
          )}
          {m.legacyMemberNo && m.legacyMemberNo.trim() !== '' && (
            <span className="bg-amber-100 text-amber-950 border border-amber-300 px-1.5 py-0.5 rounded font-bold font-mono">
              जुना: {m.legacyMemberNo.trim()}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={className}>
      <Select
        options={options}
        value={selectedOption}
        isDisabled={isDisabled}
        onChange={(selected: any) => {
          onChange(selected ? selected.value : '');
        }}
        isClearable={isClearable}
        filterOption={filterOption}
        formatOptionLabel={formatOptionLabel}
        placeholder={placeholder}
        styles={{
          control: (base, state) => ({
            ...base,
            minHeight: '28px',
            height: '28px',
            fontSize: '11px',
            borderColor: state.isFocused ? '#004a75' : '#d1d5db',
            borderRadius: '2px',
            boxShadow: state.isFocused ? '0 0 0 1px #004a75' : 'none',
            backgroundColor: isDisabled ? '#f8fafc' : '#ffffff',
            '&:hover': {
              borderColor: '#004a75'
            }
          }),
          valueContainer: (base) => ({
            ...base,
            padding: '0 6px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden'
          }),
          input: (base) => ({
            ...base,
            margin: '0',
            padding: '0',
            fontSize: '11px'
          }),
          placeholder: (base) => ({
            ...base,
            fontSize: '11px',
            color: '#9ca3af'
          }),
          singleValue: (base) => ({
            ...base,
            fontSize: '11px',
            fontWeight: '700',
            color: '#0f172a',
            maxWidth: '100%',
            overflow: 'hidden'
          }),
          menu: (base) => ({
            ...base,
            fontSize: '11px',
            borderRadius: '4px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            zIndex: 99999,
            minWidth: '420px',
            maxWidth: '650px',
            width: 'max-content'
          }),
          menuPortal: (base) => ({
            ...base,
            zIndex: 999999
          }),
          option: (base, state) => ({
            ...base,
            padding: '6px 10px',
            backgroundColor: state.isSelected ? '#e0f2fe' : state.isFocused ? '#f8fafc' : '#ffffff',
            color: '#0f172a',
            cursor: 'pointer',
            borderBottom: '1px solid #f1f5f9'
          }),
          dropdownIndicator: (base) => ({
            ...base,
            padding: '2px 4px'
          }),
          clearIndicator: (base) => ({
            ...base,
            padding: '2px 4px'
          })
        }}
        menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
      />
    </div>
  );
}

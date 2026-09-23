import React from 'react';
import Select from 'react-select';

export interface CustomerOption {
  customerID: number;
  cifNo: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  mobileNo?: string;
  aadhaarNo?: string;
  status?: string;
}

interface Props {
  customers: (CustomerOption | any)[];
  value: number | string | '' | undefined;
  onChange: (customerId: number | '') => void;
  placeholder?: string;
  className?: string;
  isDisabled?: boolean;
  isClearable?: boolean;
}

export default function CustomerSearchSelect({
  customers = [],
  value,
  onChange,
  placeholder = "-- खातेदार निवडा (CIF / नाव / मोबाईलने शोधा) --",
  className = "",
  isDisabled = false,
  isClearable = true
}: Props) {
  
  const options = React.useMemo(() => {
    if (!Array.isArray(customers)) return [];
    return customers.map((c: any) => {
      const cId = Number(c.customerID || c.customerId || c.CustomerID || 0);
      const cif = (c.cifNo || c.cif || c.CIFNo || '').trim();
      const legacyCust = (c.legacyCustomerNo || c.LegacyCustomerNo || '').trim();
      const mobile = (c.mobileNo || c.mobile || c.MobileNo || '').trim();
      const aadhaar = (c.aadhaarNo || c.aadhaar || c.AadhaarNo || '').trim();

      const fName = c.firstName || c.FirstName || '';
      const mName = c.middleName || c.MiddleName || '';
      const lName = c.lastName || c.LastName || '';
      const fullName = [fName, mName, lName].filter(Boolean).join(' ').trim();

      let codeParts: string[] = [];
      if (cif) codeParts.push(`CIF: ${cif}`);
      if (legacyCust) codeParts.push(`जुना CIF: ${legacyCust}`);
      if (mobile) codeParts.push(`मो.: ${mobile}`);

      const codeStr = codeParts.join(' | ');
      const label = codeStr ? `[${codeStr}] ${fullName}` : fullName;

      return {
        value: cId,
        label: label,
        customer: {
          ...c,
          customerID: cId,
          cifNo: cif,
          legacyCustomerNo: legacyCust,
          mobileNo: mobile,
          aadhaarNo: aadhaar,
          firstName: fName,
          middleName: mName,
          lastName: lName,
          fullName: fullName
        }
      };
    });
  }, [customers]);

  const numericValue = value !== '' && value !== undefined && value !== null ? Number(value) : '';

  const selectedOption = React.useMemo(() => {
    if (numericValue === '' || isNaN(numericValue as number)) return null;
    return options.find(o => o.value === numericValue) || null;
  }, [numericValue, options]);

  const filterOption = (option: any, rawInput: string) => {
    const input = rawInput.toLowerCase().trim();
    if (!input) return true;
    
    const { label, customer } = option.data;
    const searchString = `
      ${label} 
      ${customer.firstName} 
      ${customer.middleName || ''} 
      ${customer.lastName} 
      ${customer.fullName} 
      ${customer.cifNo || ''} 
      ${customer.legacyCustomerNo || ''} 
      ${customer.mobileNo || ''} 
      ${customer.aadhaarNo || ''}
    `.toLowerCase();

    return searchString.includes(input);
  };

  return (
    <div className={`relative ${className}`}>
      <Select
        value={selectedOption}
        onChange={(selected: any) => {
          onChange(selected ? selected.value : '');
        }}
        options={options}
        placeholder={placeholder}
        isDisabled={isDisabled}
        isClearable={isClearable}
        filterOption={filterOption}
        classNamePrefix="react-select"
        formatOptionLabel={(data: any, { context }: any) => {
          const cust = data.customer;
          if (context === 'value') {
            const cifDisplay = cust.cifNo || (cust.legacyCustomerNo ? `जुना:${cust.legacyCustomerNo}` : `ID:${cust.customerID}`);
            return (
              <div className="flex items-center gap-1.5 overflow-hidden text-[11px] py-0 w-full" title={`${cust.fullName} (${cifDisplay})`}>
                <span className="text-[10px] font-mono font-bold shrink-0 px-1.5 py-0.5 rounded bg-blue-100/80 text-blue-900 border border-blue-300 leading-none">
                  {cifDisplay}
                </span>
                <span className="font-bold text-slate-900 truncate text-[11px]">
                  {cust.fullName}
                </span>
                {cust.legacyCustomerNo && cust.cifNo && (
                  <span className="text-[10px] text-slate-500 font-medium shrink-0 hidden xl:inline">
                    (जुना: {cust.legacyCustomerNo})
                  </span>
                )}
                {cust.mobileNo && (
                  <span className="text-[10px] text-emerald-700 font-mono shrink-0 ml-auto hidden 2xl:inline">
                    📱 {cust.mobileNo}
                  </span>
                )}
              </div>
            );
          }

          return (
            <div className="flex items-center justify-between py-1 px-1 w-full gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="font-bold text-slate-900 text-xs truncate max-w-[220px] sm:max-w-[280px]">
                  {cust.fullName}
                </span>
                {cust.cifNo && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 shrink-0 whitespace-nowrap">
                    CIF: {cust.cifNo}
                  </span>
                )}
                {cust.legacyCustomerNo && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 shrink-0 whitespace-nowrap">
                    जुना CIF: {cust.legacyCustomerNo}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {cust.mobileNo && (
                  <span className="text-[10px] text-slate-600 font-mono shrink-0 whitespace-nowrap bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                    📱 {cust.mobileNo}
                  </span>
                )}
              </div>
            </div>
          );
        }}
        styles={{
          control: (base: any, state: any) => ({
            ...base,
            minHeight: '30px',
            height: '30px',
            fontSize: '11px',
            borderRadius: '2px',
            borderColor: state.isFocused ? '#0284c7' : '#d1d5db',
            boxShadow: state.isFocused ? '0 0 0 1px #0284c7' : 'none',
            backgroundColor: '#ffffff',
            '&:hover': {
              borderColor: '#9ca3af'
            }
          }),
          valueContainer: (base: any) => ({
            ...base,
            height: '30px',
            padding: '0 6px',
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden'
          }),
          singleValue: (base: any) => ({
            ...base,
            maxWidth: 'calc(100% - 8px)',
            margin: '0'
          }),
          input: (base: any) => ({
            ...base,
            margin: '0px',
            padding: '0px',
            fontSize: '11px'
          }),
          indicatorsContainer: (base: any) => ({
            ...base,
            height: '30px'
          }),
          dropdownIndicator: (base: any) => ({
            ...base,
            padding: '2px 4px'
          }),
          clearIndicator: (base: any) => ({
            ...base,
            padding: '2px 4px'
          }),
          menu: (base: any) => ({
            ...base,
            fontSize: '11px',
            zIndex: 9999,
            minWidth: '480px',
            width: 'max-content',
            maxWidth: '90vw',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            borderRadius: '4px',
            border: '1px solid #cbd5e1',
          }),
          menuList: (base: any) => ({
            ...base,
            padding: '4px',
            maxHeight: '260px',
          }),
          option: (base: any, state: any) => ({
            ...base,
            padding: '6px 8px',
            borderRadius: '4px',
            backgroundColor: state.isSelected 
              ? '#0284c7' 
              : state.isFocused 
                ? '#f0f9ff' 
                : 'white',
            color: state.isSelected ? 'white' : '#1e293b',
            cursor: 'pointer'
          })
        }}
      />
    </div>
  );
}

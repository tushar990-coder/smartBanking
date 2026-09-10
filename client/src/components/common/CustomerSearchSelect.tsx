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
  placeholder = "-- ग्राहक निवडा (CIF / नाव / मोबाईलने शोधा) --",
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
        formatOptionLabel={(data: any) => {
          const cust = data.customer;
          return (
            <div className="flex items-center justify-between py-0.5 gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900">{cust.fullName}</span>
                {cust.cifNo && (
                  <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                    CIF: {cust.cifNo}
                  </span>
                )}
                {cust.legacyCustomerNo && (
                  <span className="text-[10px] bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded font-semibold">
                    जुना CIF: {cust.legacyCustomerNo}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-500 font-medium shrink-0">
                {cust.mobileNo ? `📱 ${cust.mobileNo}` : ''}
              </div>
            </div>
          );
        }}
        styles={{
          control: (base: any, state: any) => ({
            ...base,
            minHeight: '34px',
            height: '34px',
            fontSize: '12px',
            borderColor: state.isFocused ? '#2563eb' : '#d1d5db',
            boxShadow: state.isFocused ? '0 0 0 1px #2563eb' : 'none',
            '&:hover': {
              borderColor: '#9ca3af'
            }
          }),
          valueContainer: (base: any) => ({
            ...base,
            height: '34px',
            padding: '0 8px'
          }),
          input: (base: any) => ({
            ...base,
            margin: '0px',
            padding: '0px'
          }),
          indicatorsContainer: (base: any) => ({
            ...base,
            height: '34px'
          }),
          menu: (base: any) => ({
            ...base,
            fontSize: '12px',
            zIndex: 9999
          }),
          option: (base: any, state: any) => ({
            ...base,
            padding: '6px 10px',
            backgroundColor: state.isSelected 
              ? '#2563eb' 
              : state.isFocused 
                ? '#eff6ff' 
                : 'white',
            color: state.isSelected ? 'white' : '#1f2937'
          })
        }}
      />
    </div>
  );
}

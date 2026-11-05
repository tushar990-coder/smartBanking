import React from 'react';
import Select, { components } from 'react-select';

export interface CustomerOption {
  customerID: number;
  cifNo: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  fullName?: string;
  legacyCustomerNo?: string;
  legacyLoanAccountNo?: string;
  loanAccountNo?: string;
  mobileNo?: string;
  aadhaarNo?: string;
  status?: string;
  id?: number;
  customerId?: number;
  customerName?: string;
}

interface Props {
  customers: (CustomerOption | any)[];
  value: number | string | '' | undefined;
  onChange: (customerId: number | '', searchQuery?: string) => void;
  placeholder?: string;
  className?: string;
  isDisabled?: boolean;
  isClearable?: boolean;
  menuAlign?: 'left' | 'right';
}

const MAX_RENDERED_OPTIONS = 100;

const CappedMenuList = (props: any) => {
  const { children } = props;
  const cappedChildren =
    Array.isArray(children) && children.length > MAX_RENDERED_OPTIONS
      ? children.slice(0, MAX_RENDERED_OPTIONS)
      : children;
  return <components.MenuList {...props}>{cappedChildren}</components.MenuList>;
};

const SELECT_COMPONENTS = { MenuList: CappedMenuList };

const filterCustomerOption = (option: any, inputValue: string) => {
  if (!inputValue) return true;
  const q = inputValue.toLowerCase().trim();
  if (!q) return true;
  const searchText = option.data?.searchText || '';
  return searchText.includes(q);
};

export default function CustomerSearchSelect({
  customers = [],
  value,
  onChange,
  placeholder = "-- खातेदार निवडा (CIF / जुना खातेदार नं / नाव / मोबाईलने शोधा) --",
  className = "",
  isDisabled = false,
  isClearable = true,
  menuAlign = 'left'
}: Props) {
  const lastTypedSearchRef = React.useRef<string>('');

  const options = React.useMemo(() => {
    if (!Array.isArray(customers)) return [];
    const seenIds = new Set<number>();
    const result: any[] = [];

    for (let i = 0; i < customers.length; i++) {
      const c = customers[i];
      if (!c) continue;
      const cId = Number(c.customerID || c.customerId || c.CustomerID || c.id || 0);
      if (!cId || isNaN(cId) || seenIds.has(cId)) continue;
      seenIds.add(cId);

      const cif = (c.cifNo || c.cif || c.CIFNo || '').trim();
      const legacyCust = (c.legacyCustomerNo || c.LegacyCustomerNo || c.oldCustomerCode || '').trim();
      const legacyLoan = (c.legacyLoanAccountNo || c.LegacyLoanAccountNo || c.legacyLoanNo || '').trim();
      const loanNo = (c.loanAccountNo || c.LoanAccountNo || '').trim();
      const mobile = (c.mobileNo || c.mobile || c.MobileNo || '').trim();
      const aadhaar = (c.aadhaarNo || c.aadhaar || c.AadhaarNo || '').trim();

      const fName = c.firstName || c.FirstName || '';
      const mName = c.middleName || c.MiddleName || '';
      const lName = c.lastName || c.LastName || '';
      const fullName = (c.fullName || c.FullName || c.customerName || [fName, mName, lName].filter(Boolean).join(' ')).trim();

      const codeParts: string[] = [];
      if (legacyLoan) codeParts.push(`जुने कर्ज क्र: ${legacyLoan}`);
      if (cif) codeParts.push(`CIF: ${cif}`);
      if (legacyCust) codeParts.push(`जुना खातेदार नं: ${legacyCust}`);
      if (mobile) codeParts.push(`मो.: ${mobile}`);

      const codeStr = codeParts.join(' | ');
      const label = codeStr ? `[${codeStr}] ${fullName}` : fullName;

      const searchText = `${label} ${fName} ${mName} ${lName} ${fullName} ${cif} ${legacyCust} ${legacyLoan} ${loanNo} ${mobile} ${aadhaar} ${cId}`.toLowerCase();

      result.push({
        value: cId,
        label,
        searchText,
        customer: {
          ...c,
          customerID: cId,
          cifNo: cif,
          legacyCustomerNo: legacyCust,
          legacyLoanAccountNo: legacyLoan,
          loanAccountNo: loanNo,
          mobileNo: mobile,
          aadhaarNo: aadhaar,
          firstName: fName,
          middleName: mName,
          lastName: lName,
          fullName
        }
      });
    }

    return result;
  }, [customers]);

  const numericValue = value !== '' && value !== undefined && value !== null ? Number(value) : '';

  const selectedOption = React.useMemo(() => {
    if (numericValue === '' || isNaN(numericValue as number)) return null;
    return options.find(o => o.value === numericValue) || null;
  }, [numericValue, options]);

  return (
    <div className={`relative z-50 ${className}`}>
      <Select
        value={selectedOption}
        onInputChange={(newValue: string, actionMeta: any) => {
          if (actionMeta?.action === 'input-change') {
            lastTypedSearchRef.current = newValue || '';
          }
        }}
        onBlur={() => {
          lastTypedSearchRef.current = '';
        }}
        onChange={(selected: any) => {
          const typedQuery = (lastTypedSearchRef.current || '').trim();
          lastTypedSearchRef.current = '';
          onChange(selected ? selected.value : '', typedQuery);
        }}
        options={options}
        components={SELECT_COMPONENTS}
        placeholder={placeholder}
        isDisabled={isDisabled}
        isClearable={isClearable}
        filterOption={filterCustomerOption}
        classNamePrefix="react-select"
        formatOptionLabel={(data: any, { context }: any) => {
          const cust = data.customer;
          if (context === 'value') {
            const cifDisplay = cust.cifNo || `ID:${cust.customerID}`;
            return (
              <div className="flex items-center gap-1.5 overflow-hidden text-[11px] py-0 w-full" title={`${cust.fullName} (${cifDisplay})${cust.legacyCustomerNo ? ` [जुना खातेदार नं: ${cust.legacyCustomerNo}]` : ''}${cust.legacyLoanAccountNo ? ` [जुने कर्ज: ${cust.legacyLoanAccountNo}]` : ''}`}>
                {cust.legacyLoanAccountNo && (
                  <span className="text-[10px] font-mono font-bold shrink-0 px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300 leading-none shadow-2xs">
                    जुने कर्ज: {cust.legacyLoanAccountNo}
                  </span>
                )}
                <span className="text-[10px] font-mono font-bold shrink-0 px-1.5 py-0.5 rounded bg-blue-100/80 text-blue-900 border border-blue-300 leading-none">
                  {cifDisplay}
                </span>
                {cust.legacyCustomerNo && (
                  <span className="text-[10px] font-mono font-bold shrink-0 px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 leading-none">
                    [जुना खातेदार नं: {cust.legacyCustomerNo}]
                  </span>
                )}
                <span className="font-bold text-slate-900 truncate text-[11px]">
                  {cust.fullName}
                </span>
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
                {cust.cifNo && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 shrink-0 whitespace-nowrap">
                    {cust.cifNo}
                  </span>
                )}
                {cust.legacyCustomerNo && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 shrink-0 whitespace-nowrap">
                    [जुना खातेदार नं: {cust.legacyCustomerNo}]
                  </span>
                )}
                {cust.legacyLoanAccountNo && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300 shrink-0 whitespace-nowrap shadow-2xs">
                    🏷️ जुने कर्ज क्र: {cust.legacyLoanAccountNo}
                  </span>
                )}
                <span className="font-bold text-slate-900 text-xs truncate max-w-[220px] sm:max-w-[280px]">
                  {cust.fullName}
                </span>
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
            zIndex: 99999,
            left: menuAlign === 'right' ? 'auto' : 0,
            right: menuAlign === 'right' ? 0 : 'auto',
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

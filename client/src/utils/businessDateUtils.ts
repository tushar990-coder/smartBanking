export const formatLocalYmd = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getBusinessDateStr = (businessDate?: string | null): string => {
  if (businessDate && businessDate.trim()) {
    return businessDate.split('T')[0];
  }
  return formatLocalYmd(new Date());
};

export const parseYmdAsLocalDate = (ymd: string): Date => {
  const clean = (ymd || '').split('T')[0];
  const parts = clean.split('-').map(Number);
  if (parts.length === 3 && !parts.some(Number.isNaN)) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date();
};


/**
 * Strict date formatter returning DD/MM/YYYY without JavaScript MM/DD/YYYY locale ambiguity
 * or timezone-offset day shifting on ISO YYYY-MM-DD strings.
 */
export function formatDateDDMMYYYY(value?: string | Date | null): string {
  if (!value) return '-';

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '-';
    const d = String(value.getDate()).padStart(2, '0');
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const y = value.getFullYear();
    return `${d}/${m}/${y}`;
  }

  const trimmed = String(value).trim();
  if (!trimmed) return '-';

  // Exact DD/MM/YYYY input -> return preserved as DD/MM/YYYY (never re-parse as MM/DD/YYYY)
  const ddmmyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const day = Number(ddmmyyyy[1]);
    const month = Number(ddmmyyyy[2]);
    const year = Number(ddmmyyyy[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    }
  }

  // Exact ISO YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss -> extract date parts directly
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return trimmed;
  const d = String(parsed.getDate()).padStart(2, '0');
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const y = parsed.getFullYear();
  return `${d}/${m}/${y}`;
}

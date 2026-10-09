/**
 * KYC & Statutory Identity Validation Utility
 * Standard Compliance: UIDAI Aadhaar Regulations 2016, Income Tax Department PAN Rules & CKYCR (CERSAI)
 */

// Verhoeff Algorithm Tables
const d: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];

const p: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

/**
 * Validates any number string against Verhoeff checksum algorithm (used by UIDAI)
 */
export function validateVerhoeff(numStr: string): boolean {
  if (!numStr || typeof numStr !== 'string') return false;
  const clean = numStr.trim().replace(/[\s-]/g, '');
  if (!/^\d+$/.test(clean)) return false;

  let c = 0;
  const invertedArray = clean.split('').reverse().map(Number);

  for (let i = 0; i < invertedArray.length; i++) {
    c = d[c][p[i % 8][invertedArray[i]]];
  }

  return c === 0;
}

/**
 * Validates 12-digit Indian Aadhaar Number
 */
export function isValidAadhaar(aadhaar: string): { isValid: boolean; error?: string } {
  if (!aadhaar) {
    return { isValid: false, error: 'आधार क्रमांक आवश्यक आहे.' };
  }

  const clean = aadhaar.trim().replace(/[\s-]/g, '');

  if (clean.length !== 12) {
    return { isValid: false, error: `आधार क्रमांक १२ अंकांचा असावा (सध्या ${clean.length} अंक).` };
  }

  if (!/^\d{12}$/.test(clean)) {
    return { isValid: false, error: 'आधार क्रमांकामध्ये केवळ अंक असावेत.' };
  }

  if (clean.startsWith('0') || clean.startsWith('1')) {
    return { isValid: false, error: 'UIDAI नियमांनुसार आधार क्रमांक ० किंवा १ ने सुरू होत नाही.' };
  }

  // Reject repeating all digits (e.g. 222222222222)
  if (/^(\d)\1{11}$/.test(clean)) {
    return { isValid: false, error: 'अवैध आधार क्रमांक (सर्व आकडे समान असू शकत नाहीत).' };
  }

  if (!validateVerhoeff(clean)) {
    return { isValid: false, error: 'आधार क्रमांक अमान्य आहे (Verhoeff चेकसम जुळत नाही, टायपिंग तपासा).' };
  }

  return { isValid: true };
}

/**
 * Validates 10-character Indian Permanent Account Number (PAN)
 */
export function isValidPAN(pan: string): { isValid: boolean; error?: string } {
  if (!pan) {
    return { isValid: false, error: 'पॅन क्रमांक आवश्यक आहे.' };
  }

  const clean = pan.trim().toUpperCase();

  if (clean.length !== 10) {
    return { isValid: false, error: `पॅन क्रमांक १० अक्षरी असावा (सध्या ${clean.length} अक्षरे).` };
  }

  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (!panRegex.test(clean)) {
    return { isValid: false, error: 'पॅन फॉरमॅट चुकीचा आहे (उदा. ABCDE1234F).' };
  }

  const validEntityTypes = ['P', 'C', 'H', 'A', 'B', 'T', 'F', 'G', 'J', 'L'];
  const fourthChar = clean[3];
  if (!validEntityTypes.includes(fourthChar)) {
    return { isValid: false, error: 'पॅन कार्ड मधील चौथे अक्षर वैध खातेदार प्रकार दर्शवत नाही.' };
  }

  return { isValid: true };
}

/**
 * Validates 14-digit Central KYC (CKYC) registry number
 */
export function isValidCKYC(ckyc: string): { isValid: boolean; error?: string } {
  if (!ckyc) {
    return { isValid: false, error: 'CKYC क्रमांक आवश्यक आहे.' };
  }
  const clean = ckyc.trim();
  if (!/^\d{14}$/.test(clean)) {
    return { isValid: false, error: 'CKYC क्रमांक बरोबर १४ अंकी असणे आवश्यक आहे.' };
  }
  return { isValid: true };
}

/**
 * Masks 12-digit Aadhaar number for statutory privacy compliance (UIDAI Aadhaar Act Sec 29)
 * Returns format: "XXXX-XXXX-1234"
 */
export function maskAadhaar(aadhaar?: string | null): string {
  if (!aadhaar) return '-';
  const clean = aadhaar.trim().replace(/[\s-]/g, '');
  if (clean.length === 12) {
    return `XXXX-XXXX-${clean.slice(8)}`;
  }
  if (clean.length > 4) {
    return 'X'.repeat(clean.length - 4) + clean.slice(-4);
  }
  return aadhaar;
}

/**
 * Pretty-prints an Aadhaar number with spacing: "1234 5678 9012"
 */
export function formatAadhaar(aadhaar: string): string {
  if (!aadhaar) return '';
  const clean = aadhaar.replace(/\D/g, '').slice(0, 12);
  const parts: string[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    parts.push(clean.slice(i, i + 4));
  }
  return parts.join(' ');
}

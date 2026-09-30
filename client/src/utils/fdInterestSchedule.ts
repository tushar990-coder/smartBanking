/**
 * SmartBanking Core Banking Solution
 * FD Interest Schedule & Amortization Engine
 * Generates period-wise (Quarterly/Monthly) interest charts for Fixed Deposits
 */

export interface FdSchedulePeriod {
  periodNo: number;
  periodLabel: string;
  fromDate: string;
  toDate: string;
  days: number;
  openingBalance: number;
  interestRate: number;
  interestAmount: number;
  cumulativeInterest: number;
  closingBalance: number;
  statusNote: string;
}

export interface FdScheduleSummary {
  principalAmount: number;
  interestRate: number;
  totalDays: number;
  totalPeriods: number;
  openingDate: string;
  maturityDate: string;
  maturityAmount: number;
  totalInterest: number;
  totalBenefit: number;
  isPeriodicPayout: boolean;
  monthlyInterestAmount?: number;
  schemeType: string;
  periods: FdSchedulePeriod[];
}

/**
 * Format a Date object to YYYY-MM-DD
 */
function formatDateIso(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Add calendar months to a date safely
 */
function addMonthsSafe(d: Date, months: number): Date {
  const result = new Date(d.getTime());
  const expectedMonth = result.getMonth() + months;
  result.setMonth(expectedMonth);
  // Handle month length overflow (e.g. Jan 31 -> Feb 28)
  if (result.getMonth() !== ((expectedMonth % 12) + 12) % 12) {
    result.setDate(0);
  }
  return result;
}

/**
 * Safely parse YYYY-MM-DD string into a local Date at 00:00:00 (avoiding UTC timezone drift)
 */
function parseDateOnly(str: string): Date {
  const parts = str.split('T')[0].split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

/**
 * Determine the next milestone boundary based on standard Indian financial calendar cycles:
 * - Quarterly (3 months): Cut-offs on 30 June, 30 September, 31 December, 31 March
 * - Half-Yearly (6 months): Cut-offs on 30 September, 31 March
 * - Yearly (12 months): Cut-off on 31 March
 * - Monthly (1 month): Cut-off on last day of current month
 */
function getNextMilestoneBoundary(d: Date, stepMonths: number): Date {
  const y = d.getFullYear();
  const m = d.getMonth(); // 0 to 11
  if (stepMonths === 1) {
    return new Date(y, m + 1, 1);
  }
  if (stepMonths === 6) {
    if (m >= 3 && m <= 8) return new Date(y, 9, 1);
    if (m >= 9) return new Date(y + 1, 3, 1);
    return new Date(y, 3, 1);
  }
  if (stepMonths === 12) {
    if (m >= 3) return new Date(y + 1, 3, 1);
    return new Date(y, 3, 1);
  }
  // Default Quarterly (stepMonths === 3)
  // Q1: Apr (3), May (4), Jun (5) -> Jul 1
  // Q2: Jul (6), Aug (7), Sep (8) -> Oct 1
  // Q3: Oct (9), Nov (10), Dec (11) -> Jan 1
  // Q4: Jan (0), Feb (1), Mar (2) -> Apr 1
  if (m >= 3 && m <= 5) return new Date(y, 6, 1);
  if (m >= 6 && m <= 8) return new Date(y, 9, 1);
  if (m >= 9 && m <= 11) return new Date(y + 1, 0, 1);
  return new Date(y, 3, 1);
}

/**
 * Generates the full interest amortization schedule for an FD
 */
export function generateFdInterestSchedule(params: {
  depositAmount: number;
  interestRate: number;
  openingDate: string;
  maturityDate: string;
  schemeType?: string;
  compoundingFrequency?: string;
  payoutFrequency?: string;
  targetMaturityAmount?: number;
}): FdScheduleSummary {
  const {
    depositAmount,
    interestRate,
    openingDate,
    maturityDate,
    schemeType = 'Cumulative',
    compoundingFrequency = 'Quarterly',
    payoutFrequency = 'At Maturity',
    targetMaturityAmount
  } = params;

  const p = Number(depositAmount) || 0;
  const r = Number(interestRate) || 0;

  const start = parseDateOnly(openingDate);
  const end = parseDateOnly(maturityDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || p <= 0 || end <= start) {
    return {
      principalAmount: p,
      interestRate: r,
      totalDays: 0,
      totalPeriods: 0,
      openingDate,
      maturityDate,
      maturityAmount: p,
      totalInterest: 0,
      totalBenefit: p,
      isPeriodicPayout: false,
      schemeType,
      periods: []
    };
  }

  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const isMis = schemeType === 'MIS' || schemeType === 'Monthly Interest';
  const isCumulative = schemeType === 'Cumulative';
  const isPeriodic = isMis || (payoutFrequency !== 'At Maturity' && payoutFrequency !== 'N/A' && Boolean(payoutFrequency));

  const periods: FdSchedulePeriod[] = [];

  // Determine period step interval in months
  let stepMonths = 3; // Default Quarterly (3 months)
  if (isMis || payoutFrequency === 'Monthly') {
    stepMonths = 1; // Monthly
  } else if (payoutFrequency === 'Quarterly') {
    stepMonths = 3;
  } else if (payoutFrequency === 'Half-Yearly' || compoundingFrequency === 'Half-Yearly') {
    stepMonths = 6;
  } else if (payoutFrequency === 'Yearly' || compoundingFrequency === 'Yearly') {
    stepMonths = 12;
  } else if (compoundingFrequency === 'Monthly') {
    stepMonths = 1;
  }

  let currFrom = new Date(start.getTime());
  let runningPrincipal = p;
  let runningCumulativeInt = 0;
  let periodIdx = 1;

  if (isPeriodic) {
    // ==================== Periodic Payout Schemes (MIS / Quarterly / Half-Yearly / Yearly) ====================
    let periodicInt = 0;
    let labelPrefix = 'महिना';
    let labelCode = 'M';
    let statusText = 'दरमहा बचत खात्यात/रोख जमा (Monthly Payout)';

    if (payoutFrequency === 'Quarterly') {
      periodicInt = Math.round((p * r) / 400); // 3 months
      labelPrefix = 'तिमाही';
      labelCode = 'Q';
      statusText = 'दर तीन महिन्यांनी (तिमाही) बचत खात्यात जमा (Quarterly Payout)';
    } else if (payoutFrequency === 'Half-Yearly') {
      periodicInt = Math.round((p * r) / 200); // 6 months
      labelPrefix = 'सहामाही';
      labelCode = 'H';
      statusText = 'दर सहा महिन्यांनी बचत खात्यात जमा (Half-Yearly Payout)';
    } else if (payoutFrequency === 'Yearly') {
      periodicInt = Math.round((p * r) / 100); // 12 months
      labelPrefix = 'वर्ष';
      labelCode = 'Y';
      statusText = 'वार्षिक बचत खात्यात जमा (Yearly Payout)';
    } else {
      // Monthly / MIS default
      periodicInt = Math.round((p * r) / 1200);
      labelPrefix = 'महिना';
      labelCode = 'M';
      statusText = 'दरमहा बचत खात्यात/रोख जमा (Monthly Payout)';
    }

    while (currFrom < end) {
      let nextStep = getNextMilestoneBoundary(currFrom, stepMonths);
      if (nextStep > end) nextStep = new Date(end.getTime());

      const periodDays = Math.max(1, Math.round((nextStep.getTime() - currFrom.getTime()) / (1000 * 60 * 60 * 24)));
      runningCumulativeInt += periodicInt;

      // The period end date for display is the day before nextStep begins (e.g. 30/06 instead of 01/07)
      const periodToDate = nextStep > currFrom ? new Date(nextStep.getTime() - 24 * 60 * 60 * 1000) : nextStep;

      periods.push({
        periodNo: periodIdx,
        periodLabel: `${labelPrefix} ${periodIdx} (${labelCode}${periodIdx})`,
        fromDate: formatDateIso(currFrom),
        toDate: formatDateIso(periodToDate),
        days: periodDays,
        openingBalance: p,
        interestRate: r,
        interestAmount: periodicInt,
        cumulativeInterest: runningCumulativeInt,
        closingBalance: p, // Principal remains constant
        statusNote: statusText
      });

      currFrom = nextStep;
      periodIdx++;
    }

    const totalBenefit = p + runningCumulativeInt;

    return {
      principalAmount: p,
      interestRate: r,
      totalDays,
      totalPeriods: periods.length,
      openingDate,
      maturityDate,
      maturityAmount: p, // Principal return at maturity
      totalInterest: runningCumulativeInt,
      totalBenefit,
      isPeriodicPayout: true,
      monthlyInterestAmount: periodicInt,
      schemeType,
      periods
    };
  }

  // ==================== Cumulative / Simple Scheme ====================
  // Calculate milestone periods up to maturity date
  while (currFrom < end) {
    let nextStep = getNextMilestoneBoundary(currFrom, stepMonths);
    if (nextStep > end) nextStep = new Date(end.getTime());

    const periodDays = Math.max(1, Math.round((nextStep.getTime() - currFrom.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Formula: (Principal * Rate * Days) / 36500 (Rounded to whole rupee)
    let periodInt = Math.round((runningPrincipal * r * periodDays) / 36500);

    let periodLabel = `तिमाही ${periodIdx} (Q${periodIdx})`;
    if (stepMonths === 6) periodLabel = `सहामाही ${periodIdx} (H${periodIdx})`;
    if (stepMonths === 12) periodLabel = `वर्ष ${periodIdx} (Y${periodIdx})`;
    if (stepMonths === 1) periodLabel = `महिना ${periodIdx} (M${periodIdx})`;

    let closingBal = runningPrincipal;
    let statusNote = '';

    if (isCumulative) {
      closingBal = runningPrincipal + periodInt;
      statusNote = 'पुढील मुद्दलात चक्रवाढ जमा (Compounded)';
    } else {
      // Simple Interest: Principal stays constant, interest accumulates
      closingBal = p;
      statusNote = 'मुदतअखेर देय तरतूद (Accrued for Maturity)';
    }

    runningCumulativeInt += periodInt;

    // The period end date for display is the day before nextStep begins (e.g. 30/06 instead of 01/07)
    const periodToDate = nextStep > currFrom ? new Date(nextStep.getTime() - 24 * 60 * 60 * 1000) : nextStep;

    periods.push({
      periodNo: periodIdx,
      periodLabel,
      fromDate: formatDateIso(currFrom),
      toDate: formatDateIso(periodToDate),
      days: periodDays,
      openingBalance: runningPrincipal,
      interestRate: r,
      interestAmount: periodInt,
      cumulativeInterest: runningCumulativeInt,
      closingBalance: closingBal,
      statusNote
    });

    if (isCumulative) {
      runningPrincipal = closingBal;
    }
    currFrom = nextStep;
    periodIdx++;
  }

  // Final alignment with target maturity amount if provided
  let finalMaturity = isCumulative ? runningPrincipal : (p + runningCumulativeInt);
  if (targetMaturityAmount && targetMaturityAmount > 0 && periods.length > 0) {
    const diff = targetMaturityAmount - finalMaturity;
    // If minor rounding diff (<= 5 Rs), align the last period so totals match 100%
    if (Math.abs(diff) > 0 && Math.abs(diff) <= 10) {
      const lastPeriod = periods[periods.length - 1];
      lastPeriod.interestAmount += diff;
      lastPeriod.cumulativeInterest += diff;
      if (isCumulative) {
        lastPeriod.closingBalance = targetMaturityAmount;
      }
      runningCumulativeInt += diff;
      finalMaturity = targetMaturityAmount;
    }
  }

  return {
    principalAmount: p,
    interestRate: r,
    totalDays,
    totalPeriods: periods.length,
    openingDate,
    maturityDate,
    maturityAmount: finalMaturity,
    totalInterest: runningCumulativeInt,
    totalBenefit: finalMaturity,
    isPeriodicPayout: false,
    schemeType,
    periods
  };
}

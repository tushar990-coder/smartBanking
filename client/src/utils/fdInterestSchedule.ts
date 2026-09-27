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
 * Generates the full interest amortization schedule for an FD
 */
export function generateFdInterestSchedule(params: {
  depositAmount: number;
  interestRate: number;
  openingDate: string;
  maturityDate: string;
  schemeType?: string;
  compoundingFrequency?: string;
  targetMaturityAmount?: number;
}): FdScheduleSummary {
  const {
    depositAmount,
    interestRate,
    openingDate,
    maturityDate,
    schemeType = 'Cumulative',
    compoundingFrequency = 'Quarterly',
    targetMaturityAmount
  } = params;

  const p = Number(depositAmount) || 0;
  const r = Number(interestRate) || 0;

  const start = new Date(openingDate);
  const end = new Date(maturityDate);

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

  const periods: FdSchedulePeriod[] = [];

  // Determine period step interval in months
  let stepMonths = 3; // Default Quarterly (3 months)
  if (isMis) {
    stepMonths = 1; // Monthly
  } else if (compoundingFrequency === 'Monthly') {
    stepMonths = 1;
  } else if (compoundingFrequency === 'Half-Yearly') {
    stepMonths = 6;
  } else if (compoundingFrequency === 'Yearly') {
    stepMonths = 12;
  }

  let currFrom = new Date(start.getTime());
  let runningPrincipal = p;
  let runningCumulativeInt = 0;
  let periodIdx = 1;

  if (isMis) {
    // ==================== Monthly Interest Scheme (MIS) ====================
    const monthlyInt = Math.round((p * r) / 1200);

    while (currFrom < end) {
      let nextStep = addMonthsSafe(currFrom, stepMonths);
      if (nextStep > end) nextStep = new Date(end.getTime());

      const periodDays = Math.max(1, Math.round((nextStep.getTime() - currFrom.getTime()) / (1000 * 60 * 60 * 24)));
      runningCumulativeInt += monthlyInt;

      periods.push({
        periodNo: periodIdx,
        periodLabel: `महिना ${periodIdx} (M${periodIdx})`,
        fromDate: formatDateIso(currFrom),
        toDate: formatDateIso(nextStep),
        days: periodDays,
        openingBalance: p,
        interestRate: r,
        interestAmount: monthlyInt,
        cumulativeInterest: runningCumulativeInt,
        closingBalance: p, // Principal remains constant
        statusNote: 'दरमहा बचत खात्यात/रोख जमा (Monthly Payout)'
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
      monthlyInterestAmount: monthlyInt,
      schemeType,
      periods
    };
  }

  // ==================== Cumulative / Simple Scheme ====================
  // Calculate milestone periods up to maturity date
  while (currFrom < end) {
    let nextStep = addMonthsSafe(currFrom, stepMonths);
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

    periods.push({
      periodNo: periodIdx,
      periodLabel,
      fromDate: formatDateIso(currFrom),
      toDate: formatDateIso(nextStep),
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

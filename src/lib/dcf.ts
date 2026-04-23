export interface DcfParams {
  fcf: number;
  wacc: number;
  growthRate: number;
  terminalGrowth: number;
  years: number;
  transitionYears: number;
}

export interface DCFResult {
  enterpriseValue: number;
  equityValue: number;
  netDebt: number;
  valuePerShare: number;
  projectedFCF: number[];
  annualGrowthRates: number[];
  terminalValue: number;
  presentValue: number;
  presentTerminalValue: number;
  totalPeriods: number;
  error: string | null;
}

export function calculateDCF(
  fcf: number,
  growthRate: number,
  terminalGrowthRate: number,
  wacc: number,
  years: number,
  sharesOutstanding: number,
  transitionYears: number = 5,
  totalCash: number = 0,
  totalDebt: number = 0
): DCFResult {
  if (wacc <= terminalGrowthRate) {
    return {
      enterpriseValue: 0,
      equityValue: 0,
      netDebt: totalDebt - totalCash,
      valuePerShare: 0,
      projectedFCF: [],
      annualGrowthRates: [],
      terminalValue: 0,
      presentValue: 0,
      presentTerminalValue: 0,
      totalPeriods: 0,
      error: 'WACC must be greater than Terminal Growth Rate',
    };
  }

  if (sharesOutstanding <= 0) {
    return {
      enterpriseValue: 0,
      equityValue: 0,
      netDebt: totalDebt - totalCash,
      valuePerShare: 0,
      projectedFCF: [],
      annualGrowthRates: [],
      terminalValue: 0,
      presentValue: 0,
      presentTerminalValue: 0,
      totalPeriods: 0,
      error: 'Shares outstanding must be greater than zero',
    };
  }

  const projectedFCF: number[] = [];
  const annualGrowthRates: number[] = [];
  let currentFCF = fcf;

  // STAGE 1: Initial growth
  for (let i = 1; i <= years; i++) {
    currentFCF *= 1 + growthRate / 100;
    projectedFCF.push(currentFCF);
    annualGrowthRates.push(growthRate);
  }

  // STAGE 2: Linear transition from growthRate to terminalGrowthRate
  for (let i = 1; i <= transitionYears; i++) {
    const stage2Growth = growthRate - ((growthRate - terminalGrowthRate) * (i / transitionYears));
    currentFCF *= 1 + stage2Growth / 100;
    projectedFCF.push(currentFCF);
    annualGrowthRates.push(stage2Growth);
  }

  const totalPeriods = years + transitionYears;
  const lastFCF = projectedFCF[projectedFCF.length - 1];
  const terminalValue = (lastFCF * (1 + terminalGrowthRate / 100)) / (wacc / 100 - terminalGrowthRate / 100);

  let presentValue = 0;
  for (let i = 0; i < projectedFCF.length; i++) {
    presentValue += projectedFCF[i] / Math.pow(1 + wacc / 100, i + 1);
  }

  const presentTerminalValue = terminalValue / Math.pow(1 + wacc / 100, totalPeriods);
  const enterpriseValue = presentValue + presentTerminalValue;
  const netDebt = totalDebt - totalCash;
  const equityValue = enterpriseValue + totalCash - totalDebt;
  const valuePerShare = equityValue / sharesOutstanding;

  return {
    enterpriseValue,
    equityValue,
    netDebt,
    valuePerShare,
    projectedFCF,
    annualGrowthRates,
    terminalValue,
    presentValue,
    presentTerminalValue,
    totalPeriods,
    error: null,
  };
}

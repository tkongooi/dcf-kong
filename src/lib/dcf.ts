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
) {
  // Input validation: WACC must exceed terminal growth for Gordon Growth Model
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

  const projectedFCF = [];
  const annualGrowthRates = [];
  let currentFCF = fcf;

  // 1. STAGE 1: Initial Growth Period (Years 1 to 'years')
  for (let i = 1; i <= years; i++) {
    currentFCF *= 1 + growthRate / 100;
    projectedFCF.push(currentFCF);
    annualGrowthRates.push(growthRate);
  }

  // 2. STAGE 2: Transition Period (Years 'years+1' to 'years + transitionYears')
  // Growth rate linearly decays from 'growthRate' to 'terminalGrowthRate'
  for (let i = 1; i <= transitionYears; i++) {
    const stage2Growth = growthRate - ((growthRate - terminalGrowthRate) * (i / transitionYears));
    currentFCF *= 1 + stage2Growth / 100;
    projectedFCF.push(currentFCF);
    annualGrowthRates.push(stage2Growth);
  }

  // 3. STAGE 3: Terminal Value calculation at the end of the transition period
  const totalPeriods = years + transitionYears;
  const lastFCF = projectedFCF[projectedFCF.length - 1];
  const terminalValue = (lastFCF * (1 + terminalGrowthRate / 100)) / (wacc / 100 - terminalGrowthRate / 100);

  // 4. Discount all projected cash flows to Present Value (PV)
  let presentValue = 0;
  for (let i = 0; i < projectedFCF.length; i++) {
    presentValue += projectedFCF[i] / Math.pow(1 + wacc / 100, i + 1);
  }

  // 5. Discount Terminal Value to Present Value
  const presentTerminalValue = terminalValue / Math.pow(1 + wacc / 100, totalPeriods);

  // 6. Enterprise Value (EV)
  const enterpriseValue = presentValue + presentTerminalValue;

  // 7. Equity Value = EV + Cash - Debt
  const netDebt = totalDebt - totalCash;
  const equityValue = enterpriseValue + totalCash - totalDebt;

  // 8. Value per Share
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

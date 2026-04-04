export function calculateDCF(
  fcf: number,
  growthRate: number,
  terminalGrowthRate: number,
  wacc: number,
  years: number,
  sharesOutstanding: number
) {
  const projectedFCF = [];
  let currentFCF = fcf;

  // 1. Project FCF for the given period
  for (let i = 1; i <= years; i++) {
    currentFCF *= 1 + growthRate / 100;
    projectedFCF.push(currentFCF);
  }

  // 2. Calculate Terminal Value
  // TV = FCF_last * (1 + terminal_growth) / (WACC - terminal_growth)
  const lastFCF = projectedFCF[projectedFCF.length - 1];
  const terminalValue = (lastFCF * (1 + terminalGrowthRate / 100)) / (wacc / 100 - terminalGrowthRate / 100);

  // 3. Discount all cash flows to Present Value
  let presentValue = 0;
  for (let i = 0; i < projectedFCF.length; i++) {
    presentValue += projectedFCF[i] / Math.pow(1 + wacc / 100, i + 1);
  }

  // 4. Discount Terminal Value to Present Value
  const presentTerminalValue = terminalValue / Math.pow(1 + wacc / 100, years);

  // 5. Enterprise Value
  const enterpriseValue = presentValue + presentTerminalValue;

  // 6. Value per Share
  const valuePerShare = enterpriseValue / sharesOutstanding;

  return {
    enterpriseValue,
    valuePerShare,
    projectedFCF,
    terminalValue,
    presentValue,
    presentTerminalValue
  };
}

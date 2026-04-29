import { describe, it, expect } from "vitest";
import { calculateDCF } from "./dcf";

describe("calculateDCF", () => {
  it("returns error when WACC <= terminal growth", () => {
    const r = calculateDCF(10, 5, 5, 5, 5, 1);
    expect(r.error).toBe("WACC must be greater than Terminal Growth Rate");
    expect(r.valuePerShare).toBe(0);
  });

  it("returns error when WACC < terminal growth", () => {
    const r = calculateDCF(10, 5, 6, 5, 5, 1);
    expect(r.error).toBe("WACC must be greater than Terminal Growth Rate");
  });

  it("returns error when shares <= 0", () => {
    const r = calculateDCF(10, 5, 2, 10, 5, 0);
    expect(r.error).toBe("Shares outstanding must be greater than zero");
  });

  it("returns error for negative shares", () => {
    const r = calculateDCF(10, 5, 2, 10, 5, -1);
    expect(r.error).toBe("Shares outstanding must be greater than zero");
  });

  it("projects FCF for initial + transition stages", () => {
    const r = calculateDCF(100, 10, 2, 10, 5, 1, 5);
    expect(r.error).toBeNull();
    expect(r.projectedFCF).toHaveLength(10);
    expect(r.annualGrowthRates).toHaveLength(10);
    // First 5 years use the 10% initial growth
    expect(r.annualGrowthRates.slice(0, 5)).toEqual([10, 10, 10, 10, 10]);
    // Transition fades from 10% to 2% across 5 years
    expect(r.annualGrowthRates[5]).toBeCloseTo(8.4, 6);
    expect(r.annualGrowthRates[9]).toBeCloseTo(2, 6);
  });

  it("computes terminal value via Gordon growth", () => {
    const r = calculateDCF(100, 10, 2, 10, 5, 1, 5);
    const lastFcf = r.projectedFCF[r.projectedFCF.length - 1];
    const expectedTV = (lastFcf * 1.02) / (0.10 - 0.02);
    expect(r.terminalValue).toBeCloseTo(expectedTV, 6);
  });

  it("discounts terminal value to present", () => {
    const r = calculateDCF(100, 10, 2, 10, 5, 1, 5);
    const expectedPV = r.terminalValue / Math.pow(1.10, 10);
    expect(r.presentTerminalValue).toBeCloseTo(expectedPV, 6);
  });

  it("equity value = EV + cash - debt", () => {
    const r = calculateDCF(100, 10, 2, 10, 5, 1, 5, 50, 30);
    expect(r.equityValue).toBeCloseTo(r.enterpriseValue + 50 - 30, 6);
    expect(r.netDebt).toBe(-20);
  });

  it("value per share = equityValue / shares", () => {
    const r = calculateDCF(100, 10, 2, 10, 5, 4, 5);
    expect(r.valuePerShare).toBeCloseTo(r.equityValue / 4, 6);
  });

  it("matches a hand-computed single-stage scenario (transitionYears=0)", () => {
    // FCF=100, g=5%, WACC=10%, term=2%, 5y, transition=0
    // Year 1..5 FCF = 100*1.05^t
    const r = calculateDCF(100, 5, 2, 10, 5, 1, 0);
    expect(r.error).toBeNull();
    expect(r.projectedFCF).toHaveLength(5);
    let pv = 0;
    for (let t = 1; t <= 5; t++) {
      pv += (100 * Math.pow(1.05, t)) / Math.pow(1.10, t);
    }
    const tv = (100 * Math.pow(1.05, 5) * 1.02) / (0.10 - 0.02);
    const ptv = tv / Math.pow(1.10, 5);
    expect(r.presentValue).toBeCloseTo(pv, 4);
    expect(r.enterpriseValue).toBeCloseTo(pv + ptv, 4);
  });

  it("handles zero growth", () => {
    const r = calculateDCF(100, 0, 0, 10, 5, 1, 5);
    expect(r.error).toBeNull();
    // With g=0, all projected FCF stays at 100
    expect(r.projectedFCF.every(f => Math.abs(f - 100) < 1e-9)).toBe(true);
  });

  it("handles negative growth", () => {
    const r = calculateDCF(100, -5, 2, 10, 5, 1, 0);
    expect(r.error).toBeNull();
    expect(r.projectedFCF[4]).toBeCloseTo(100 * Math.pow(0.95, 5), 6);
  });

  it("totalPeriods reflects initial + transition", () => {
    const r = calculateDCF(100, 10, 2, 10, 7, 1, 3);
    expect(r.totalPeriods).toBe(10);
    expect(r.projectedFCF).toHaveLength(10);
  });

  it("netDebt computed even on error path", () => {
    const r = calculateDCF(10, 5, 5, 5, 5, 1, 5, 100, 250);
    expect(r.error).not.toBeNull();
    expect(r.netDebt).toBe(150);
  });
});

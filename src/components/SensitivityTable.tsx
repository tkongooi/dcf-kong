import React, { useMemo } from "react";
import { calculateDCF } from "@/lib/dcf";

interface SensitivityTableProps {
  fcf: number;
  sharesOutstanding: number;
  terminalGrowth: number;
  years: number;
  wacc: number;
  growthRate: number;
  currency: string;
  transitionYears: number;
  totalCash: number;
  totalDebt: number;
}

export const SensitivityTable: React.FC<SensitivityTableProps> = React.memo(({
  fcf,
  sharesOutstanding,
  terminalGrowth,
  years,
  wacc,
  growthRate,
  currency,
  transitionYears,
  totalCash,
  totalDebt,
}) => {
  const waccRange = useMemo(() => [wacc - 2, wacc - 1, wacc, wacc + 1, wacc + 2].filter(v => v > 0), [wacc]);
  const growthRange = useMemo(() => [growthRate - 2, growthRate - 1, growthRate, growthRate + 1, growthRate + 2], [growthRate]);

  const gridValues = useMemo(() => {
    return growthRange.map((g) =>
      waccRange.map((w) => {
        const result = calculateDCF(fcf, g, terminalGrowth, w, years, sharesOutstanding, transitionYears, totalCash, totalDebt);
        return result.valuePerShare;
      })
    );
  }, [fcf, sharesOutstanding, terminalGrowth, years, waccRange, growthRange, transitionYears, totalCash, totalDebt]);

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
      <h3 className="text-lg font-semibold mb-4 text-slate-900">Sensitivity Analysis (Fair Value)</h3>
      <table className="w-full text-sm text-left border-collapse">
        <thead>
          <tr>
            <th className="p-2 border-b border-r bg-slate-50 text-slate-500 font-medium">Growth \ WACC</th>
            {waccRange.map((w) => (
              <th key={w} className="p-2 border-b bg-slate-50 text-center font-bold text-blue-600">
                {w.toFixed(1)}%
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {growthRange.map((g, gIdx) => (
            <tr key={g}>
              <td className="p-2 border-r bg-slate-50 font-bold text-blue-600">
                {g.toFixed(1)}%
              </td>
              {waccRange.map((w, wIdx) => {
                const value = gridValues[gIdx][wIdx];
                const isCurrent = Math.abs(g - growthRate) < 1e-6 && Math.abs(w - wacc) < 1e-6;
                return (
                  <td
                    key={`${g}-${w}`}
                    className={`p-2 text-center border-b border-r last:border-r-0 ${
                      isCurrent ? "bg-blue-50 font-bold ring-2 ring-blue-500 ring-inset" : ""
                    }`}
                  >
                    {currency} {value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-xs text-slate-400 italic">
        * Table shows intrinsic value per share for different combinations of WACC and Growth Rate.
      </p>
    </div>
  );
});

SensitivityTable.displayName = "SensitivityTable";

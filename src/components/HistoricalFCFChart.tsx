import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";

interface HistoricalFCFProps {
  data: { date: string; fcf: number; ocf?: number; capex?: number }[];
}

export const HistoricalFCFChart: React.FC<HistoricalFCFProps> = ({ data }) => {
  // Yahoo Finance returns data from newest to oldest. Reverse for chart.
  const chartData = [...data].reverse();

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <h3 className="text-lg font-semibold mb-6 text-slate-900 text-left">Historical Free Cash Flow (Billion)</h3>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 10 }} 
              dy={10}
              tickFormatter={(date) => {
                const d = new Date(date);
                return isNaN(d.getTime()) ? date : d.getFullYear().toString();
              }}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickFormatter={(val) => `${val.toFixed(1)}B`}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              formatter={(val: any) => [`${Number(val).toFixed(2)} Billion`, ""]}
            />
            <Legend verticalAlign="top" height={36}/>
            <Bar dataKey="ocf" name="Op. Cash Flow" fill="#94a3b8" radius={[4, 4, 0, 0]} />
            <Bar dataKey="fcf" name="Free Cash Flow" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fcf >= 0 ? "#2563eb" : "#ef4444"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-4 text-xs text-slate-400 italic">
        * FCF = Operating Cash Flow + Capital Expenditures. Red bars indicate negative FCF.
      </p>
    </div>
  );
};

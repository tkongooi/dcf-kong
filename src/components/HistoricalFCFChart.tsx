import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";

interface HistoricalFCFProps {
  data: { date: string; fcf: number; ocf?: number; capex?: number }[];
  projections?: number[];
  growthRates?: number[];
  initialYears?: number;
}

export const HistoricalFCFChart: React.FC<HistoricalFCFProps> = ({ 
  data, 
  projections, 
  growthRates,
  initialYears = 5 
}) => {
  // Historical data from newest to oldest. Reverse for chart.
  const historical = [...data].reverse().map(item => ({
    ...item,
    type: "Historical",
    growth: null,
    displayDate: new Date(item.date).getFullYear().toString()
  }));

  const projectedData = projections ? projections.map((fcf, i) => {
    const lastYear = historical.length > 0 
      ? parseInt(historical[historical.length - 1].displayDate) 
      : new Date().getFullYear();
    
    return {
      date: `Year ${i + 1}`,
      displayDate: (lastYear + i + 1).toString(),
      fcf,
      type: (i + 1) <= initialYears ? "Initial Projection" : "Transition Projection",
      growth: growthRates ? growthRates[i] : null
    };
  }) : [];

  const chartData = [...historical, ...projectedData];

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <h3 className="text-lg font-semibold mb-6 text-slate-900 text-left">FCF History & Projections (Billion)</h3>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="displayDate" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 10 }} 
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickFormatter={(val) => `${val.toFixed(1)}B`}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              formatter={(val: any, name: any, props: any) => {
                const { type, growth } = props.payload;
                const valueStr = `${Number(val).toFixed(2)} Billion`;
                const growthStr = growth !== null ? ` (Growth: ${growth.toFixed(1)}%)` : "";
                return [`${valueStr}${growthStr}`, type];
              }}
            />
            <Legend verticalAlign="top" height={36}/>
            <Bar dataKey="fcf" name="Free Cash Flow" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => {
                let color = "#2563eb"; // Historical Blue
                if (entry.fcf < 0) color = "#ef4444"; // Negative Red
                else if (entry.type === "Initial Projection") color = "#8b5cf6"; // Initial Purple
                else if (entry.type === "Transition Projection") color = "#d946ef"; // Transition Pink
                
                return <Cell key={`cell-${index}`} fill={color} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-wider">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#2563eb] rounded"></div> Historical</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#8b5cf6] rounded"></div> Initial Growth</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#d946ef] rounded"></div> Transition</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#ef4444] rounded"></div> Negative FCF</div>
      </div>
    </div>
  );
};
